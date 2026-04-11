"use client";

import { useEffect, useState } from "react";
import { openChannel, type ChannelOpenResponse, type ErrorResponse } from "@/lib/api";

interface AgentLookupProps {
  onChannelOpened: (channel: ChannelOpenResponse) => void;
  prefillAgent?: string;
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

export default function AgentLookup({ onChannelOpened, prefillAgent }: AgentLookupProps) {
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: number;
    data: ChannelOpenResponse | ErrorResponse;
  } | null>(null);

  useEffect(() => {
    if (prefillAgent) setAgentId(prefillAgent);
  }, [prefillAgent]);

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await openChannel(agentId.trim());
      setResult(res);
      if (res.status === 200) {
        onChannelOpened(res.data as ChannelOpenResponse);
      }
    } catch {
      setResult({
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

  const isSuccess = result?.status === 200;
  const data = result?.data;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <h2 className="text-lg font-semibold mb-4">Open Payment Channel</h2>

      <form onSubmit={handleOpen} className="flex gap-3 mb-4">
        <input
          type="text"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Enter agent ID (e.g. 1253)"
          className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 font-mono"
        />
        <button
          type="submit"
          disabled={loading || !agentId.trim()}
          className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            "Gate & Open"
          )}
        </button>
      </form>

      {result && !isSuccess && data && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 font-semibold text-sm uppercase tracking-wider">
              {(data as ErrorResponse).error === "agent_rejected"
                ? "Rejected"
                : "Error"}
            </span>
            <span className="text-white/30 text-xs">HTTP {result.status}</span>
          </div>
          <p className="text-white/70 text-sm">{(data as ErrorResponse).message}</p>
          {(data as ErrorResponse).score !== undefined && (
            <div className="mt-3 flex gap-4 text-xs text-white/50">
              <span>Score: <span className="text-white/80 font-mono">{(data as ErrorResponse).score}</span></span>
              {(data as ErrorResponse).tier && <span>Tier: <span className="text-white/80 font-mono">{(data as ErrorResponse).tier}</span></span>}
              {(data as ErrorResponse).riskLevel && <span>Risk: <span className={RISK_COLORS[(data as ErrorResponse).riskLevel!] || "text-white/80"}>{(data as ErrorResponse).riskLevel}</span></span>}
            </div>
          )}
        </div>
      )}

      {result && isSuccess && data && (() => {
        const ch = data as ChannelOpenResponse;
        return (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">
                Channel Opened
              </span>
              <span className="text-white/30 text-xs font-mono">{ch.sessionId.slice(0, 8)}…</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Score" value={String(ch.score)} />
              <Stat label="Tier" value={ch.tier} className={TIER_COLORS[ch.tier] || ""} />
              <Stat label="Risk" value={ch.riskLevel} className={RISK_COLORS[ch.riskLevel] || ""} />
              <Stat label="Credit Line" value={ch.creditLineReadable} />
              <Stat label="Duration" value={`${Math.round(ch.durationSeconds / 60)} min`} />
              <Stat label="Max Requests" value={ch.maxRequests === null ? "Unlimited" : String(ch.maxRequests)} />
            </div>
            <p className="mt-3 text-xs text-emerald-400/60">No payment required — consume services freely, settle when done.</p>
          </div>
        );
      })()}
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
