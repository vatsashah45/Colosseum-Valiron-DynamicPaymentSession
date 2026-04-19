const agents = [
  "1253", "1254", "1000", "2000",
  "AlphaScout", "Veridia", "LocalTrader",
  "agent-001", "test-agent-1", "solana-agent-1",
];

async function main() {
  for (const id of agents) {
    try {
      const res = await fetch(`http://localhost:3000/channel/open/${id}`, { method: "POST" });
      const d = await res.json();
      const ok = res.status === 200;
      console.log(`${id}: score=${d.score ?? "?"} tier=${d.tier ?? "?"} risk=${d.riskLevel ?? "?"} → ${ok ? "ACCEPTED (sid=" + d.sessionId + ")" : "REJECTED"}`);
    } catch (e) {
      console.log(`${id}: ERROR ${e.message}`);
    }
  }
}
main();
