"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getChannelStatus,
  consume,
  type ChannelOpenResponse,
  type ChannelStatusResponse,
  type SettlementResponse,
  type ConsumeResponse,
} from "@/lib/api";
import {
  settleWithPayment,
  type PaymentProgress,
} from "@/lib/solana-payment";

interface ChannelPanelProps {
  channel: ChannelOpenResponse;
  onSettled: () => void;
  walletPublicKey: string | null;
  signTransaction: <T>(tx: T) => Promise<T>;
}

export default function ChannelPanel({ channel, onSettled, walletPublicKey, signTransaction }: ChannelPanelProps) {
  const [status, setStatus] = useState<ChannelStatusResponse | null>(null);
  const [cost, setCost] = useState("0.50");
  const [desc, setDesc] = useState("API call");
  const [consuming, setConsuming] = useState(false);
  const [lastResult, setLastResult] = useState<{
    status: number;
    data: Record<string, unknown> | ConsumeResponse;
  } | null>(null);
  const [settling, setSettling] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResponse | null>(null);
  const [paymentProgress, setPaymentProgress] = useState<PaymentProgress | null>(null);
  const [logs, setLogs] = useState<
    { time: string; action: string; detail: string; ok: boolean }[]
  >([]);

  const refresh = useCallback(async () => {
    try {
      const s = await getChannelStatus(channel.sessionId);
      setStatus(s);
    } catch {
      // ignore
    }
  }, [channel.sessionId]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [refresh]);

  function addLog(action: string, detail: string, ok: boolean) {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString(), action, detail, ok },
      ...prev.slice(0, 29),
    ]);
  }

  async function handleConsume(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(cost);
    if (isNaN(amount) || amount <= 0) return;
    setConsuming(true);
    setLastResult(null);
    try {
      const res = await consume(channel.sessionId, amount, desc);
      setLastResult(res);
      if (res.status === 200) {
        addLog("CONSUME", `$${amount} → 200 OK (instant, no payment)`, true);
      } else {
        addLog(
          "CONSUME",
          `$${amount} → ${res.status} ${(res.data as { error?: string }).error || ""}`,
          false
        );
      }
      refresh();
    } catch {
      addLog("CONSUME", `$${amount} → connection error`, false);
    } finally {
      setConsuming(false);
    }
  }

  async function handleSettle() {
    if (!walletPublicKey) {
      addLog("SETTLE", "Connect your Phantom wallet first", false);
      return;
    }
    setSettling(true);
    setPaymentProgress(null);
    setLastResult(null);
    try {
      const result = await settleWithPayment(
        channel.sessionId,
        walletPublicKey,
        signTransaction,
        (p) => setPaymentProgress(p),
      );

      if (result.success && result.settlement) {
        const s = result.settlement;
        setSettlement(s);
        addLog(
          "SETTLE",
          `Settled on-chain! ${s.totalConsumedReadable} USDC for ${s.requestsServed} requests`,
          true,
        );
      } else {
        addLog("SETTLE", result.error || "Settlement failed", false);
        setLastResult({ status: 500, data: { error: result.error } });
      }
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Settlement failed";
      addLog("SETTLE", msg, false);
      setPaymentProgress({ step: "error", detail: msg });
    } finally {
      setSettling(false);
    }
  }

  const secondsLeft = status?.secondsRemaining ?? 0;
  const pctTime = Math.max(0, (secondsLeft / channel.durationSeconds) * 100);

  const creditNum = parseFloat(channel.creditLineReadable.replace("$", ""));
  const consumedReadable = status?.consumedReadable ?? "$0.00";
  const consumedNum = parseFloat(consumedReadable.replace("$", ""));
  const pctCredit = creditNum > 0 ? Math.max(0, ((creditNum - consumedNum) / creditNum) * 100) : 100;

  const reqCount = status?.requestCount ?? 0;
  const maxReqs = channel.maxRequests;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Channel</h2>
        <div className="flex items-center gap-3">
          {status?.active !== false && !settlement && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Open
            </span>
          )}
          {settlement && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Settled
            </span>
          )}
          <span className="text-xs text-white/30 font-mono">
            {channel.sessionId.slice(0, 8)}…
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
          label="Credit Remaining"
          value={status?.remainingReadable ?? channel.creditLineReadable}
          pct={pctCredit}
          color="bg-emerald-400"
        />
        <Gauge
          label="Requests"
          value={maxReqs ? `${reqCount} / ${maxReqs}` : `${reqCount} / ∞`}
          pct={maxReqs ? Math.max(0, 100 - (reqCount / maxReqs) * 100) : 100}
          color="bg-purple-400"
        />
      </div>

      {/* Tab summary */}
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-white/40">Tab: </span>
          <span className="font-mono text-white/90">{consumedReadable}</span>
          <span className="text-white/30"> / {channel.creditLineReadable}</span>
        </div>
        <div>
          <span className="text-white/40">Requests served: </span>
          <span className="font-mono text-white/90">{reqCount}</span>
        </div>
      </div>

      {/* Consume Form */}
      {!settlement && status?.active !== false && (
        <form onSubmit={handleConsume} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs text-white/40 block mb-1">Cost (USDC)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono focus:outline-none focus:border-white/30"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-white/40 block mb-1">Service</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
            />
          </div>
          <button
            type="submit"
            disabled={consuming}
            className="px-5 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-30 font-medium transition-colors"
          >
            {consuming ? "…" : "Consume"}
          </button>
          <button
            type="button"
            onClick={handleSettle}
            disabled={settling || !walletPublicKey}
            title={!walletPublicKey ? "Connect Phantom wallet to settle" : "Settle & close channel"}
            className="px-5 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-30 font-medium transition-colors"
          >
            {settling ? "Settling…" : !walletPublicKey ? "Connect Wallet" : "Settle & Close"}
          </button>
        </form>
      )}

      {/* Last Result */}
      {lastResult && (
        <div
          className={`rounded-lg p-3 text-sm font-mono ${
            lastResult.status === 200
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : lastResult.status === 402
              ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
              : "bg-red-500/10 border border-red-500/20 text-red-300"
          }`}
        >
          <span className="text-white/40 mr-2">HTTP {lastResult.status}</span>
          {lastResult.status === 200 && "Service consumed — added to tab (no payment)"}
          {lastResult.status === 403 && `Denied: ${(lastResult.data as { error?: string }).error}`}
          {lastResult.status === 410 && "Channel expired"}
          {lastResult.status === 429 && "Max requests reached"}
          {lastResult.status === 500 && (lastResult.data as { error?: string }).error}
        </div>
      )}

      {/* Payment Progress */}
      {paymentProgress && !settlement && (
        <div className={`rounded-lg p-3 text-sm font-mono ${
          paymentProgress.step === "error"
            ? "bg-red-500/10 border border-red-500/20 text-red-300"
            : paymentProgress.step === "confirmed"
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
            : "bg-blue-500/10 border border-blue-500/20 text-blue-300"
        }`}>
          <span className="text-white/40 mr-2">
            {paymentProgress.step === "challenge" && "1/4"}
            {paymentProgress.step === "building" && "2/4"}
            {paymentProgress.step === "signing" && "3/4"}
            {paymentProgress.step === "submitting" && "4/4"}
            {paymentProgress.step === "confirmed" && "✓"}
            {paymentProgress.step === "error" && "✗"}
          </span>
          {paymentProgress.detail}
        </div>
      )}

      {/* Settlement Summary */}
      {settlement && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
          <div className="text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wider">
            Settlement Complete
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-white/40">Requests Served: </span>
              <span className="font-mono">{settlement.requestsServed}</span>
            </div>
            <div>
              <span className="text-white/40">Total Tab: </span>
              <span className="font-mono text-emerald-400">{settlement.totalConsumedReadable}</span>
            </div>
            <div>
              <span className="text-white/40">Unused Credit: </span>
              <span className="font-mono text-white/60">{settlement.unusedCreditReadable}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-blue-400/60">
            Real on-chain USDC settlement on Solana mainnet — one transaction for the entire session.
          </p>
        </div>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <div>
          <h3 className="text-xs text-white/40 uppercase tracking-wider mb-2">Activity Log</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-white/20 w-20 shrink-0">{log.time}</span>
                <span className={`w-20 shrink-0 ${log.ok ? "text-emerald-400/70" : "text-red-400/70"}`}>
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

function Gauge({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
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
