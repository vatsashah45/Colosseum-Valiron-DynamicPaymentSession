import { ValironSDK } from "@valiron/sdk";
import { CONFIG, TIER_POLICY } from "./config.js";
import type { GateCheckResult, SessionPolicy } from "./types.js";

const valiron = new ValironSDK({
  chain: "solana",
  endpoint: CONFIG.valiron.baseUrl,
});

/**
 * Gate an agent through Valiron and resolve session policy.
 * Returns allowed=false if the agent is below the min score threshold.
 */
export async function gateAgent(agentId: string): Promise<GateCheckResult> {
  const result = await valiron.gate(agentId);

  if (!result.allow || result.score < CONFIG.valiron.minScore) {
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
