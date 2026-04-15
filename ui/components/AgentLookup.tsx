"use client";

import { useEffect, useState } from "react";
import {
  preflightChannel,
  openChannel,
  type PreflightResponse,
  type ChannelOpenResponse,
  type ErrorResponse,
} from "@/lib/api";
import {
  depositToEscrow,
  type DepositProgress,
} from "@/lib/solana-payment";

interface AgentLookupProps {
  onChannelOpened: (channel: ChannelOpenResponse) => void;
  prefillAgent?: string;
  walletAddress?: string | null;
  signTransaction: <T>(tx: T) => Promise<T>;
}

const TIER_COLORS: Record<string, string> = {
  AAA: "text-emerald-400",
  AA: "text-green-400",
  A: "text-teal-400",
  BAA: "text-yellow-400",
  BA: "text-orange-400",
  B: "text-red-400",
};

const RISK_COLORS: Record<string, string> = {
  GREEN: "text-emerald-400",
  YELLOW: "text-yellow-400",
  ORANGE: "text-orange-400",
  RED: "text-red-500",
};

export default function AgentLookup({ onChannelOpened, prefillAgent, walletAddress, signTransaction }: AgentLookupProps) {
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [depositProgress, setDepositProgress] = useState<DepositProgress | null>(null);
  const [error, setError] = useState<{ status: number; data: ErrorResponse } | null>(null);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);

  useEffect(() => {
    if (prefillAgent) setAgentId(prefillAgent);
  }, [prefillAgent]);

  // Step 1: Gate check (preflight)
  async function handlePreflight(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId.trim()) return;
    if (!walletAddress) {
      setError({
        status: 0,
        data: {
          error: "wallet_required",
          message: "Connect your Phantom wallet before opening a channel.",
        },
      });
      return;
    }
    setLoading(true);
    setError(null);
    setPreflight(null);
    setDepositProgress(null);
    try {
      const res = await preflightChannel(agentId.trim(), walletAddress);
      if (res.status === 200) {
        setPreflight(res.data as PreflightResponse);
      } else {
        setError({ status: res.status, data: res.data as ErrorResponse });
      }
    } catch {
      setError({
        status: 0,
        data: {
          error: "connection_failed",
          message: "Cannot reach the server. Is it running on port 3000?",
        },
      });
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Deposit to escrow + open channel
  async function handleDeposit() {
    if (!preflight || !walletAddress) return;
    setDepositing(true);
    setDepositProgress(null);
    setError(null);

    try {
      // Build and sign the USDC deposit via Phantom
      const result = await depositToEscrow(
        preflight.escrowAddress,
        preflight.creditLine,
        walletAddress,
        signTransaction,
        (p) => setDepositProgress(p),
      );

      if (!result.success || !result.txSignature) {
        setError({
          status: 0,
          data: {
            error: "deposit_failed",
            message: result.error || "Escrow deposit failed.",
          },
        });
        setDepositing(false);
        return;
      }

      // Open channel with the deposit signature
      setDepositProgress({
        step: "submitting",
        detail: "Verifying deposit and opening channel…",
      });

      const openRes = await openChannel(agentId.trim(), walletAddress, result.txSignature);

      if (openRes.status === 200) {
        setDepositProgress({
          step: "confirmed",
          detail: "Channel opened with escrowed deposit!",
          txSignature: result.txSignature,
        });
        onChannelOpened(openRes.data as ChannelOpenResponse);
        setPreflight(null);
      } else {
        setError({ status: openRes.status, data: openRes.data as ErrorResponse });
      }
    } catch (err) {
      setError({
        status: 0,
        data: {
          error: "deposit_failed",
          message: err instanceof Error ? err.message : "Deposit failed.",
        },
      });
    } finally {
      setDepositing(false);
    }
  }

  function handleReset() {
    setPreflight(null);
    setError(null);
    setDepositProgress(null);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <h2 className="text-lg font-semibold mb-4">Open Payment Channel</h2>

      {/* Step 1: Agent ID input */}
      <form onSubmit={handlePreflight} className="flex gap-3 mb-4">
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Enter agent ID (e.g. 1253)"
          disabled={!!preflight}
          className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 font-mono disabled:opacity-50"
        />
        {!preflight ? (
          <button
            type="submit"
            disabled={loading || !agentId.trim()}
            className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? (
              <span className="inline-block animate-spin">⟳</span>
            ) : (
              "Gate Check"
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors text-sm"
          >
            Reset
          </button>
        )}
      </form>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 font-semibold text-sm uppercase tracking-wider">
              {error.data.error === "agent_rejected"
                ? "Rejected"
                : error.data.error === "insufficient_balance"
                ? "Insufficient USDC"
                : error.data.error === "unsettled_debt"
                ? "Unsettled Debt"
                : error.data.error === "wallet_required"
                ? "Wallet Required"
                : error.data.error === "deposit_failed"
                ? "Deposit Failed"
                : error.data.error === "deposit_invalid"
                ? "Deposit Invalid"
                : "Error"}
            </span>
            {error.status > 0 && (
              <span className="text-white/30 text-xs">HTTP {error.status}</span>
            )}
          </div>
          <p className="text-white/70 text-sm">{error.data.message}</p>
          {error.data.score !== undefined && (
            <div className="mt-3 flex gap-4 text-xs text-white/50">
              <span>Score: <span className="text-white/80 font-mono">{error.data.score}</span></span>
              {error.data.tier && <span>Tier: <span className="text-white/80 font-mono">{error.data.tier}</span></span>}
              {error.data.riskLevel && <span>Risk: <span className={RISK_COLORS[error.data.riskLevel] || "text-white/80"}>{error.data.riskLevel}</span></span>}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Preflight result — show tier info + deposit button */}
      {preflight && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-400 font-semibold text-sm uppercase tracking-wider">
              Gate Passed — Deposit Required
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Stat label="Score" value={String(preflight.score)} />
            <Stat label="Tier" value={preflight.tier} className={TIER_COLORS[preflight.tier] || ""} />
            <Stat label="Risk" value={preflight.riskLevel} className={RISK_COLORS[preflight.riskLevel] || ""} />
            <Stat label="Credit Line" value={preflight.creditLineReadable} />
            <Stat label="Duration" value={`${Math.round(preflight.durationSeconds / 60)} min`} />
            <Stat label="Max Requests" value={preflight.maxRequests === null ? "Unlimited" : String(preflight.maxRequests)} />
            <Stat label="Escrow" value={`${preflight.escrowAddress.slice(0, 4)}…${preflight.escrowAddress.slice(-4)}`} />
          </div>
          <p className="text-xs text-blue-400/60 mb-4">
            Deposit {preflight.creditLineReadable} USDC into escrow to open the channel. Unused credit is refunded at settlement.
          </p>
          <button
            onClick={handleDeposit}
            disabled={depositing}
            className="w-full px-6 py-3 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 font-semibold transition-colors"
          >
            {depositing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">⟳</span>
                Depositing…
              </span>
            ) : (
              `Deposit ${preflight.creditLineReadable} USDC & Open Channel`
            )}
          </button>
        </div>
      )}

      {/* Deposit Progress */}
      {depositProgress && (
        <div className={`rounded-lg p-3 text-sm font-mono ${
          depositProgress.step === "error"
            ? "bg-red-500/10 border border-red-500/20 text-red-300"
            : depositProgress.step === "confirmed"
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
            : "bg-blue-500/10 border border-blue-500/20 text-blue-300"
        }`}>
          <span className="text-white/40 mr-2">
            {depositProgress.step === "building" && "1/3"}
            {depositProgress.step === "signing" && "2/3"}
            {depositProgress.step === "submitting" && "3/3"}
            {depositProgress.step === "confirmed" && "✓"}
            {depositProgress.step === "error" && "✗"}
          </span>
          {depositProgress.detail}
          {depositProgress.step === "confirmed" && "txSignature" in depositProgress && (
            <span className="block text-xs text-white/30 mt-1 break-all">
              tx: {depositProgress.txSignature}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="text-xs text-white/40 mb-0.5">{label}</div>
      <div className={`font-mono font-semibold ${className || "text-white/90"}`}>{value}</div>
    </div>
  );
}
