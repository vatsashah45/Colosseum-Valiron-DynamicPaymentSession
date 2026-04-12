"use client";

import { useEffect, useState } from "react";
import AgentLookup from "@/components/AgentLookup";
import ChannelPanel from "@/components/SessionPanel";
import TierTable from "@/components/TierTable";
import { checkHealth, type ChannelOpenResponse } from "@/lib/api";
import { usePhantom } from "@/lib/usePhantom";

const SAMPLE_AGENTS = [
  { id: "1209", name: "Sentinel" },
  { id: "1211", name: "DataPilot" },
  { id: "1212", name: "TrustNode" },
  { id: "1210", name: "TradeBot" },
  { id: "1213", name: "Watchdog" },
];

export default function Home() {
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [activeChannel, setActiveChannel] =
    useState<ChannelOpenResponse | null>(null);
  const [prefillAgent, setPrefillAgent] = useState("");
  const { publicKey, connected, hasPhantom, connect, disconnect, signTransaction } = usePhantom();

  useEffect(() => {
    checkHealth().then(setServerUp);
    const iv = setInterval(() => checkHealth().then(setServerUp), 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">
            Dynamic Payment Channels
          </h1>
          {/* Wallet Connect */}
          <div className="flex items-center gap-3">
            {connected && publicKey ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
                </span>
                <button
                  onClick={disconnect}
                  className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-medium text-sm transition-colors"
              >
                {hasPhantom ? "Connect Phantom" : "Install Phantom"}
              </button>
            )}
          </div>
        </div>
        <p className="text-white/50 text-sm max-w-2xl">
          Agents open a channel once, consume services freely, and settle at the
          end — no per-request transactions, no friction. Trust scores determine
          credit lines and channel duration. Powered by{" "}
          <span className="text-white/70">Valiron</span> reputation and{" "}
          <span className="text-white/70">Solana USDC</span> settlement.
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
            1. Gate Agent & Open Channel
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
          onChannelOpened={(ch) => setActiveChannel(ch)}
        />
      </section>

      {/* Active Channel */}
      {activeChannel && (
        <section>
          <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">
            2. Consume Services & Settle
          </h2>
          <ChannelPanel
            channel={activeChannel}
            onSettled={() => setActiveChannel(null)}
            walletPublicKey={publicKey}
            signTransaction={signTransaction}
          />
        </section>
      )}

      {/* Tier Reference */}
      <section>
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">
          Tier Policy Reference
        </h2>
        <TierTable activeTier={activeChannel?.tier} />
      </section>

      {/* Architecture */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center text-sm">
          <Step
            n={1}
            title="Open Channel"
            desc="Gate check via Valiron → trust tier → credit line assigned"
          />
          <Step
            n={2}
            title="Consume Freely"
            desc="Each request is instant (200 OK) — costs added to tab"
          />
          <Step
            n={3}
            title="Tab Tracked"
            desc="Server enforces credit line, duration, and request cap"
          />
          <Step
            n={4}
            title="Settle Once"
            desc="One real USDC payment on Solana mainnet for the total tab at close"
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
