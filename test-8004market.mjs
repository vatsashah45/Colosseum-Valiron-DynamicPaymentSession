// Test with real agents from 8004market.io (Solana mainnet)
const SERVER = "http://localhost:3000";

// Picked agents with varying review counts for score diversity
const AGENTS = [
  { id: "1253", name: "Local Trader", reviews: 78 },
  { id: "1218", name: "AlphaScout", reviews: 24 },
  { id: "1225", name: "CryptoIZ", reviews: 4 },
  { id: "1213", name: "TradeBot-Beta", reviews: 12 },
  { id: "1210", name: "TradeBot-Alpha", reviews: 3 },
  { id: "1204", name: "x402 Seller", reviews: 8 },
  { id: "1206", name: "ChainPulse", reviews: 1 },
  { id: "1241", name: "Veridia", reviews: 0 },
  { id: "1227", name: "Bazaar Trader", reviews: 0 },
  { id: "1161", name: "NullTrace", reviews: 0 },
];

async function main() {
  console.log("Dynamic Payment Sessions — 8004market.io Agent Test\n");

  console.log(
    "Agent ID | Name                  | Score | Tier | Risk   | Tx Limit     | Duration | Max Tx"
  );
  console.log(
    "---------|----------------------|-------|------|--------|--------------|----------|-------"
  );

  for (const agent of AGENTS) {
    try {
      const res = await fetch(`${SERVER}/session/open/${agent.id}`, { method: "POST" });
      const data = await res.json();

      if (res.status === 200) {
        const dur = `${Math.round(data.durationSeconds / 60)} min`;
        const maxTx = data.maxTransactions === null ? "∞" : String(data.maxTransactions);
        console.log(
          `${agent.id.padEnd(8)} | ${agent.name.padEnd(20)} | ${String(data.score).padEnd(5)} | ${data.tier.padEnd(4)} | ${data.riskLevel.padEnd(6)} | ${data.transactionLimitReadable.padEnd(12)} | ${dur.padEnd(8)} | ${maxTx}`
        );
      } else if (res.status === 403) {
        console.log(
          `${agent.id.padEnd(8)} | ${agent.name.padEnd(20)} | ${String(data.score).padEnd(5)} | ${(data.tier || "?").padEnd(4)} | ${(data.riskLevel || "?").padEnd(6)} | REJECTED     |          |`
        );
      } else {
        console.log(`${agent.id.padEnd(8)} | ${agent.name.padEnd(20)} | ERROR ${res.status}: ${data.message || data.error}`);
      }
    } catch (e) {
      console.log(`${agent.id.padEnd(8)} | ${agent.name.padEnd(20)} | UNREACHABLE`);
    }
  }
}

main().catch(console.error);
