import type { SessionPolicy } from "./types.js";

// ─── Tier Policy Table ──────────────────────────────────────────────────────
// Maps Valiron Moody's-style tier to channel constraints.
// creditLine = max USDC (base units, 6 decimals) the agent can consume on tab.
// durationSeconds = how long the channel stays open.
// maxRequests = max service calls allowed, null = unlimited.

export const TIER_POLICY: Record<string, SessionPolicy> = {
  AAA: { creditLine: 100_000_000, durationSeconds: 3600, maxRequests: null },
  AA:  { creditLine:  50_000_000, durationSeconds: 2700, maxRequests: 50 },
  A:   { creditLine:  25_000_000, durationSeconds: 1800, maxRequests: 30 },
  BAA: { creditLine:  10_000_000, durationSeconds: 1200, maxRequests: 20 },
  BA:  { creditLine:   5_000_000, durationSeconds:  900, maxRequests: 10 },
  B:   { creditLine:   1_000_000, durationSeconds:  600, maxRequests: 5 },
};

// ─── Config ─────────────────────────────────────────────────────────────────

export const CONFIG = {
  port: Number(process.env.PORT) || 3000,

  solana: {
    network: (process.env.SOLANA_NETWORK || "devnet") as "devnet" | "mainnet-beta",
    recipient: process.env.RECIPIENT_WALLET || "",
    usdcMint:
      process.env.USDC_MINT ||
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    rpcUrl: process.env.SOLANA_RPC_URL,
  },

  valiron: {
    baseUrl:
      process.env.VALIRON_URL ||
      "https://valiron-edge-proxy.onrender.com",
    minScore: Number(process.env.MIN_SCORE) || 45,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format base-unit amount to human-readable USD string */
export function formatUSDC(baseUnits: number): string {
  return `$${(baseUnits / 1_000_000).toFixed(2)}`;
}
