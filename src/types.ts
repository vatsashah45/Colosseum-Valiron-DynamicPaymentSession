import type { GateResult } from "@valiron/sdk";

// ─── Session Types ──────────────────────────────────────────────────────────

export interface SessionPolicy {
  /** Max USDC in base units (6 decimals) the agent can consume on tab */
  creditLine: number;
  /** Channel duration in seconds */
  durationSeconds: number;
  /** Max number of service requests allowed, null = unlimited */
  maxRequests: number | null;
}

export interface UsageRecord {
  requestId: string;
  cost: number;
  description?: string;
  timestamp: Date;
}

export interface Session {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  creditLine: number;
  consumed: number;
  maxRequests: number | null;
  requestCount: number;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
  settled: boolean;
  settlementSignature?: string;
  walletAddress: string;
  usage: UsageRecord[];
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface ChannelOpenResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  creditLine: string;
  creditLineReadable: string;
  maxRequests: number | null;
  expiresAt: string;
  durationSeconds: number;
  walletVerified: boolean;
  walletBalance: string;
}

export interface ConsumeResponse {
  requestId: string;
  cost: string;
  costReadable: string;
  description?: string;
  session: {
    consumed: string;
    consumedReadable: string;
    remaining: string;
    remainingReadable: string;
    requestCount: number;
    maxRequests: number | null;
    secondsRemaining: number;
  };
}

export interface ChannelStatusResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  creditLine: string;
  creditLineReadable: string;
  consumed: string;
  consumedReadable: string;
  remaining: string;
  remainingReadable: string;
  requestCount: number;
  maxRequests: number | null;
  expiresAt: string;
  secondsRemaining: number;
  active: boolean;
  settled: boolean;
}

export interface SettlementResponse {
  sessionId: string;
  settled: boolean;
  totalConsumed: string;
  totalConsumedReadable: string;
  requestsServed: number;
  unusedCredit: string;
  unusedCreditReadable: string;
  settlementChallenge?: Record<string, unknown>;
}

export interface GateCheckResult {
  allowed: boolean;
  result: GateResult;
  policy?: SessionPolicy;
}
