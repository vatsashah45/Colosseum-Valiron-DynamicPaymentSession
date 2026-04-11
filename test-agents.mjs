// Test multiple agents to show tier differentiation
const SERVER = "http://localhost:3000";
const AGENTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

async function main() {
  console.log("Agent  | Score | Tier | Risk   | Tx Limit     | Duration | Max Tx");
  console.log("-------|-------|------|--------|--------------|----------|-------");

  for (const agentId of AGENTS) {
    try {
      const res = await fetch(`${SERVER}/session/open/${agentId}`, { method: "POST" });
      const data = await res.json();

      if (res.status === 200) {
        const dur = `${Math.round(data.durationSeconds / 60)} min`;
        const maxTx = data.maxTransactions === null ? "∞" : String(data.maxTransactions);
        console.log(
          `${agentId.padEnd(6)} | ${String(data.score).padEnd(5)} | ${data.tier.padEnd(4)} | ${data.riskLevel.padEnd(6)} | ${data.transactionLimitReadable.padEnd(12)} | ${dur.padEnd(8)} | ${maxTx}`
        );
      } else if (res.status === 403) {
        console.log(
          `${agentId.padEnd(6)} | ${String(data.score).padEnd(5)} | ${(data.tier || "?").padEnd(4)} | ${(data.riskLevel || "?").padEnd(6)} | REJECTED     |          |`
        );
      } else {
        console.log(`${agentId.padEnd(6)} | ERROR (${res.status})`);
      }
    } catch (e) {
      console.log(`${agentId.padEnd(6)} | UNREACHABLE`);
    }
  }
}

main().catch(console.error);
