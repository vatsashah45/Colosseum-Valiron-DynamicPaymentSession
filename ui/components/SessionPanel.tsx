"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSessionStatus,
  closeSession,
  transact,
  type SessionOpenResponse,
  type SessionStatusResponse,
} from "@/lib/api";

interface SessionPanelProps {
  session: SessionOpenResponse;
  onClosed: () => void;
}

export default function SessionPanel({ session, onClosed }: SessionPanelProps) {
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [txAmount, setTxAmount] = useState("0.50");
  const [txDesc, setTxDesc] = useState("API call");
  const [txLoading, setTxLoading] = useState(false);
  const [txResult, setTxResult] = useState<{
    status: number;
    data: Record<string, unknown>;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<
    { time: string; action: string; detail: string; ok: boolean }[]
  >([]);

  const refresh = useCallback(async () => {
    try {
      const s = await getSessionStatus(session.sessionId);
      setStatus(s);
    } catch {
      // ignore
    }
  }, [session.sessionId]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [refresh]);

  function addLog(action: string, detail: string, ok: boolean) {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString(), action, detail, ok },
      ...prev.slice(0, 19),
    ]);
  }

  async function handleTransact(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0) return;
    setTxLoading(true);
    setTxResult(null);
    try {
      const res = await transact(session.sessionId, amount, txDesc);
      setTxResult(res);
      if (res.status === 402) {
        addLog(
          "TRANSACT",
          `$${amount} → 402 Payment Required (challenge issued)`,
          true
        );
      } else if (res.status === 200) {
        addLog("TRANSACT", `$${amount} → ✓ paid`, true);
      } else {
        addLog(
          "TRANSACT",
          `$${amount} → ${res.status} ${(res.data as { error?: string }).error || ""}`,
          false
        );
      }
      refresh();
    } catch {
      addLog("TRANSACT", `$${amount} → connection error`, false);
    } finally {
      setTxLoading(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      const res = await closeSession(session.sessionId);
      setCloseResult(res as unknown as Record<string, unknown>);
      addLog("CLOSE", `Session closed. Total spent: ${(res as { totalSpentReadable?: string }).totalSpentReadable || "?"}`, true);
      onClosed();
    } catch {
      addLog("CLOSE", "Failed to close session", false);
    } finally {
      setClosing(false);
    }
  }

  const secondsLeft = status?.secondsRemaining ?? 0;
  const pctTime = status
    ? Math.max(0, (secondsLeft / session.durationSeconds) * 100)
    : 100;

  const remainingUSDC = status?.remainingLimitReadable ?? session.transactionLimitReadable;
  const limitNum = parseFloat(session.transactionLimitReadable.replace("$", ""));
  const remainNum = parseFloat(remainingUSDC.replace("$", ""));
  const pctLimit = limitNum > 0 ? Math.max(0, (remainNum / limitNum) * 100) : 100;

  const txUsed = status?.transactionsUsed ?? session.transactionsUsed;
  const txMax = session.maxTransactions;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Session</h2>
        <div className="flex items-center gap-3">
          {status?.active !== false && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
          <span className="text-xs text-white/30 font-mono">
            {session.sessionId.slice(0, 8)}…
          </span>
        </div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Gauge
          label="Time Remaining"
          value={`${Math.floor(secondsLeft / 60)}m ${secondsLeft % 60}s`}
          pct={pctTime}
          color="bg-blue-400"
        />
        <Gauge
          label="Spend Remaining"
          value={remainingUSDC}
          pct={pctLimit}
          color="bg-emerald-400"
        />
        <Gauge
          label="Transactions"
          value={txMax ? `${txUsed} / ${txMax}` : `${txUsed} / ∞`}
          pct={txMax ? Math.max(0, 100 - (txUsed / txMax) * 100) : 100}
          color="bg-purple-400"
        />
      </div>

      {/* Send Transaction */}
      {!closeResult && status?.active !== false && (
        <form onSubmit={handleTransact} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-white/40 block mb-1">
              Amount (USDC)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-white/40 block mb-1">
              Description
            </label>
            <input
              type="text"
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={txLoading}
            className="px-5 py-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-30 font-medium transition-colors"
          >
            {txLoading ? "…" : "Transact"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="px-5 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 font-medium transition-colors"
          >
            Close
          </button>
        </form>
      )}

      {/* Last Transaction Result */}
      {txResult && (
        <div
          className={`rounded-lg p-3 text-sm font-mono ${
            txResult.status === 402
              ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
              : txResult.status === 200
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-red-500/10 border border-red-500/20 text-red-300"
          }`}
        >
          <span className="text-white/40 mr-2">HTTP {txResult.status}</span>
          {txResult.status === 402 && "Payment challenge issued (402)"}
          {txResult.status === 200 && "Payment completed"}
          {txResult.status === 403 &&
            `Denied: ${(txResult.data as { error?: string }).error}`}
          {txResult.status === 410 && "Session expired"}
        </div>
      )}

      {/* Close Result */}
      {closeResult && (
        <div className="rounded-lg bg-white/5 border border-white/10 p-4">
          <div className="text-sm font-semibold text-white/60 mb-2 uppercase tracking-wider">
            Session Summary
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-white/40">Transactions: </span>
              <span className="font-mono">
                {closeResult.transactionsCompleted as number}
              </span>
            </div>
            <div>
              <span className="text-white/40">Total Spent: </span>
              <span className="font-mono text-emerald-400">
                {closeResult.totalSpentReadable as string}
              </span>
            </div>
            <div>
              <span className="text-white/40">Unused Limit: </span>
              <span className="font-mono text-white/60">
                {closeResult.unusedLimit as string}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-2">
            Activity Log
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-white/20 w-20 shrink-0">{log.time}</span>
                <span
                  className={`w-20 shrink-0 ${
                    log.ok ? "text-emerald-400/70" : "text-red-400/70"
                  }`}
                >
                  {log.action}
                </span>
                <span className="text-white/50 truncate">{log.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Gauge({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{label}</span>
        <span className="font-mono text-white/80">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
