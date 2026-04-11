"use client";

import { useEffect, useState } from "react";
import AgentLookup from "@/components/AgentLookup";
import SessionPanel from "@/components/SessionPanel";
import TierTable from "@/components/TierTable";
import { checkHealth, type SessionOpenResponse } from "@/lib/api";

const SAMPLE_AGENTS = [
  { id: "1241", name: "Veridia" },
  { id: "1253", name: "Local Trader" },
  { id: "1218", name: "AlphaScout" },
  { id: "1220", name: "DeFi Oracle" },
  { id: "1210", name: "SolBot" },
];

export default function Home() {
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [activeSession, setActiveSession] =
    useState<SessionOpenResponse | null>(null);
  const [prefillAgent, setPrefillAgent] = useState("");

  useEffect(() => {
    checkHealth().then(setServerUp);
    const iv = setInterval(() => checkHealth().then(setServerUp), 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Dynamic Payment Sessions
        </h1>
        <p className="text-white/50 text-sm max-w-2xl">
          Transaction limits and session durations adapt based on agent trust
          scores. Higher-trust agents get larger payment windows. Powered by{" "}
          <span className="text-white/70">Valiron</span> reputation scoring and{" "}
          <span className="text-white/70">Solana USDC</span> via micropayment
          protocol.
        </p>
      </div>

      {/* Server Status */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            serverUp === null
              ? "bg-white/20"
              : serverUp
              ? "bg-emerald-400"
              : "bg-red-400"
          }`}
        />
        <span className="text-white/50">
          {serverUp === null
            ? "Checking server…"
            : serverUp
            ? "Server running on :3000"
            : "Server offline — start with npm run dev"}
        </span>
      </div>

      {/* Agent Lookup */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">
            1. Gate Agent & Open Session
          </h2>
          <div className="flex items-center gap-2 text-xs text-white/30">
            Try:
            {SAMPLE_AGENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setPrefillAgent(a.id)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors font-mono"
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
        <AgentLookup
          prefillAgent={prefillAgent}
          onSessionCreated={(s) => setActiveSession(s)}
        />
      </section>

      {/* Active Session */}
      {activeSession && (
        <section>
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">
            2. Session Controls
          </h2>
          <SessionPanel
            session={activeSession}
            onClosed={() => setActiveSession(null)}
          />
        </section>
      )}

      {/* Tier Reference */}
      <section>
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">
          Tier Policy Reference
        </h2>
        <TierTable activeTier={activeSession?.tier} />
      </section>

      {/* Architecture */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center text-sm">
          <Step
            n={1}
            title="Agent Requests Access"
            desc="POST /session/open/:agentId"
          />
          <Step
            n={2}
            title="Valiron Gate Check"
            desc="Score, tier, risk level from on-chain reputation"
          />
          <Step
            n={3}
            title="Session Created"
            desc="Tier-based limits: tx cap, spend limit, duration"
          />
          <Step
            n={4}
            title="Transact via MPP"
            desc="Each tx is a real USDC charge on Solana"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-white/20 pb-8">
        Built for Colosseum Hackathon · Valiron × Solana Micropayment Protocol
      </footer>
    </main>
  );
}

function Step({
  n,
  title,
  desc,
}: {
  n: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="space-y-2">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mx-auto font-mono text-sm text-white/60">
        {n}
      </div>
      <div className="font-medium text-white/80">{title}</div>
      <div className="text-white/40 text-xs">{desc}</div>
    </div>
  );
}
