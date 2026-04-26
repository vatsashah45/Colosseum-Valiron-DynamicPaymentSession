import { ValironSDK } from "@valiron/sdk";
import { CONFIG, TIER_POLICY } from "./config.js";
import type { GateCheckResult, SessionPolicy } from "./types.js";

const valiron = new ValironSDK({
  chain: "solana",
  endpoint: CONFIG.valiron.baseUrl,
  timeout: 20_000,
  debug: process.env.VALIRON_DEBUG === "true",
});

/**
 * Gate an agent through Valiron and resolve session policy.
 * Returns allowed=false if the agent is below the min score threshold.
 */
export async function gateAgent(agentId: string): Promise<GateCheckResult> {
  console.log(`[gate] Starting gate for agent ${agentId}`);
  const start = Date.now();
  const result = await valiron.gate(agentId, { ttlMs: 300_000 });
  console.log(`[gate] Gate completed in ${Date.now() - start}ms — score=${result.score} tier=${result.tier}`);

  // Use our own minScore threshold (independent of Valiron's default gate allow)
  if (result.score < CONFIG.valiron.minScore) {
    return { allowed: false, result };
  }

  const policy = tierToPolicy(result.tier);
  return { allowed: true, result, policy };
}

/**
 * Map a Valiron tier to session policy.
 * Falls back to the most restrictive tier (B) for unknown tiers.
 */
function tierToPolicy(tier: string): SessionPolicy {
  return TIER_POLICY[tier] ?? TIER_POLICY["B"]!;
}
