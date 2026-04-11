import type { SessionPolicy } from "./types.js";

// ─── Tier Policy Table ──────────────────────────────────────────────────────
// Maps Valiron Moody's-style tier to session constraints.
// All amounts in USDC base units (6 decimals). 1_000_000 = $1.00

export const TIER_POLICY: Record<string, SessionPolicy> = {
  AAA: { transactionLimit: 100_000_000, durationSeconds: 3600, maxTransactions: null },
  AA:  { transactionLimit:  50_000_000, durationSeconds: 2700, maxTransactions: 50 },
  A:   { transactionLimit:  25_000_000, durationSeconds: 1800, maxTransactions: 30 },
  BAA: { transactionLimit:  10_000_000, durationSeconds: 1200, maxTransactions: 20 },
  BA:  { transactionLimit:   5_000_000, durationSeconds:  900, maxTransactions: 10 },
  B:   { transactionLimit:   1_000_000, durationSeconds:  600, maxTransactions: 5 },
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
