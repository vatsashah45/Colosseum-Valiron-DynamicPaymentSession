/**
 * Demo: Simulate multiple agents opening sessions to show trust-adaptive limits.
 *
 * This script hits the session server's /session/open endpoint with different
 * agent IDs and prints a comparison table of the session terms each agent receives.
 *
 * Usage: DEMO_SERVER=http://localhost:3000 tsx demo/simulate.ts
 */

const SERVER = process.env.DEMO_SERVER || "http://localhost:3000";

// Agent IDs to test — use known agent IDs from Valiron
const AGENT_IDS = process.env.AGENT_IDS?.split(",") || [
  "25459",
  "8348",
  "1719",
  "2001",
];

interface SessionResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  transactionLimitReadable: string;
  durationSeconds: number;
  maxTransactions: number | null;
}

interface ErrorResponse {
  error: string;
  score?: number;
  tier?: string;
  riskLevel?: string;
  message: string;
}

async function openSession(
  agentId: string,
): Promise<{ agentId: string; data: SessionResponse | ErrorResponse; status: number }> {
  const res = await fetch(`${SERVER}/session/open/${agentId}`, {
    method: "POST",
  });
  const data = await res.json();
  return { agentId, data, status: res.status };
}

async function main() {
  console.log(`\nDynamic Payment Sessions — Demo`);
  console.log(`Server: ${SERVER}`);
  console.log(`Testing ${AGENT_IDS.length} agents...\n`);

  // Check server health
  try {
    const health = await fetch(`${SERVER}/health`);
    if (!health.ok) throw new Error(`status ${health.status}`);
  } catch (e) {
    console.error(`Server unreachable at ${SERVER}`);
    process.exit(1);
  }

  const results = await Promise.all(AGENT_IDS.map(openSession));

  // Print table
  const rows = results.map(({ agentId, data, status }) => {
    if (status === 200) {
      const s = data as SessionResponse;
      return {
        Agent: agentId,
        Score: s.score,
        Tier: s.tier,
        Risk: s.riskLevel,
        "Tx Limit": s.transactionLimitReadable,
        Duration: `${Math.round(s.durationSeconds / 60)} min`,
        "Max Tx": s.maxTransactions === null ? "∞" : s.maxTransactions,
      };
    } else {
      const e = data as ErrorResponse;
      return {
        Agent: agentId,
        Score: e.score ?? "?",
        Tier: e.tier ?? "?",
        Risk: e.riskLevel ?? "?",
        "Tx Limit": "REJECTED",
        Duration: "—",
        "Max Tx": "—",
      };
    }
  });

  console.table(rows);

  // Show a session status check for the first successful session
  const firstSuccess = results.find((r) => r.status === 200);
  if (firstSuccess) {
    const s = firstSuccess.data as SessionResponse;
    console.log(`\nSession detail for agent ${s.agentId} (${s.tier}):`);
    const statusRes = await fetch(`${SERVER}/session/status/${s.sessionId}`);
    const status = await statusRes.json();
    console.log(JSON.stringify(status, null, 2));
  }
}

main().catch(console.error);
