import {
  ValironSDK,
  type ChainContext,
  type GateResult,
  type MoodysRating,
  type RiskLevel,
  type RouteDecision,
  type SandboxResult,
} from "@valiron/sdk";
import { CONFIG, TIER_POLICY } from "./config.js";
import type { GateCheckResult, SessionPolicy } from "./types.js";

const valiron = new ValironSDK({
  chain: "solana",
  endpoint: CONFIG.valiron.baseUrl,
  timeout: 75_000,
  debug: process.env.VALIRON_DEBUG === "true",
});

/**
 * Gate an agent through Valiron and resolve session policy.
 * Returns allowed=false if the agent is below the min score threshold.
 */
export async function gateAgent(agentId: string): Promise<GateCheckResult> {
  console.log(`[gate] Starting gate for agent ${agentId}`);
  const start = Date.now();
  const profile = await valiron.getAgentProfile(agentId, { chain: "solana" });
  let result = profileToGateResult(agentId, profile);

  if (shouldRunSandbox(result, profile)) {
    console.log(`[gate] No usable profile score for ${agentId}; running Solana sandbox evaluation`);
    const sandbox = await valiron.triggerSandboxTest(agentId, { chain: "solana" });
    result = sandboxToGateResult(agentId, sandbox);
  }

  console.log(`[gate] Gate completed in ${Date.now() - start}ms — score=${result.score} tier=${result.tier} route=${result.route}`);

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

function shouldRunSandbox(
  result: GateResult,
  profile: Awaited<ReturnType<ValironSDK["getAgentProfile"]>>,
): boolean {
  const hasLocalScore = Number.isFinite(profile.localReputation?.score);
  const hasOnchainScore =
    Number.isFinite(profile.onchainReputation?.solana?.qualityScore) &&
    Number(profile.onchainReputation?.solana?.qualityScore) > 0;
  return result.score < CONFIG.valiron.minScore && result.route === "sandbox" && !hasLocalScore && !hasOnchainScore;
}

function profileToGateResult(
  fallbackAgentId: string,
  profile: Awaited<ReturnType<ValironSDK["getAgentProfile"]>>,
): GateResult {
  const score = resolveScore(profile);
  const tier = normalizeTier(profile.localReputation?.tier) ?? tierForScore(score);
  const riskLevel = normalizeRisk(profile.localReputation?.riskLevel) ?? riskForTier(tier);
  const route = normalizeRoute(profile.routing?.finalRoute) ?? routeForTier(tier);
  const allow = score >= CONFIG.valiron.minScore && route !== "sandbox_only";

  return {
    allow,
    score,
    tier,
    riskLevel,
    route,
    agentId: profile.agentId || fallbackAgentId,
    wallet: profile.identity?.wallet ?? "",
    chain: profile.chain,
    sandboxRan: false,
    cached: true,
  };
}

function sandboxToGateResult(fallbackAgentId: string, sandbox: SandboxResult): GateResult {
  const score = clampScore(Math.round(Number(sandbox.valironScore ?? 0)));
  const tier = normalizeTier(sandbox.tier) ?? tierForScore(score);
  const riskLevel = normalizeRisk(sandbox.riskLevel) ?? riskForTier(tier);
  const route = routeForTier(tier);

  return {
    allow: score >= CONFIG.valiron.minScore && route !== "sandbox_only",
    score,
    tier,
    riskLevel,
    route,
    agentId: sandbox.agentId || fallbackAgentId,
    wallet: sandbox.wallet ?? "",
    chain: sandbox.chain as ChainContext,
    sandboxRan: true,
    cached: false,
  };
}

function resolveScore(profile: Awaited<ReturnType<ValironSDK["getAgentProfile"]>>): number {
  const candidates = [
    profile.localReputation?.score,
    profile.onchainReputation?.solana?.qualityScore,
    profile.onchainReputation?.averageScore,
  ];
  const score = candidates.find((value) => Number.isFinite(value));
  return clampScore(Math.round(Number(score ?? 0)));
}

function normalizeTier(value: unknown): MoodysRating | undefined {
  const tiers: MoodysRating[] = ["AAA", "AA", "A", "BAA", "BA", "B", "CAA", "CA", "C"];
  return tiers.includes(value as MoodysRating) ? (value as MoodysRating) : undefined;
}

function normalizeRisk(value: unknown): RiskLevel | undefined {
  const risks: RiskLevel[] = ["GREEN", "YELLOW", "RED"];
  return risks.includes(value as RiskLevel) ? (value as RiskLevel) : undefined;
}

function normalizeRoute(value: unknown): RouteDecision | undefined {
  const routes: RouteDecision[] = ["prod", "prod_throttled", "sandbox", "sandbox_only"];
  return routes.includes(value as RouteDecision) ? (value as RouteDecision) : undefined;
}

function tierForScore(score: number): MoodysRating {
  if (score >= 95) return "AAA";
  if (score >= 90) return "AA";
  if (score >= 85) return "A";
  if (score >= 75) return "BAA";
  if (score >= 65) return "BA";
  if (score >= 50) return "B";
  if (score >= 35) return "CAA";
  if (score >= 20) return "CA";
  return "C";
}

function riskForTier(tier: MoodysRating): RiskLevel {
  if (tier === "AAA" || tier === "AA" || tier === "A") return "GREEN";
  if (tier === "BAA" || tier === "BA") return "YELLOW";
  return "RED";
}

function routeForTier(tier: MoodysRating): RouteDecision {
  if (tier === "AAA" || tier === "AA" || tier === "A") return "prod";
  if (tier === "BAA" || tier === "BA") return "prod_throttled";
  if (tier === "B") return "sandbox";
  return "sandbox_only";
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}
