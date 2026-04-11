import type { GateResult } from "@valiron/sdk";

// ─── Session Types ──────────────────────────────────────────────────────────

export interface SessionPolicy {
  /** Max USDC in base units (6 decimals) the agent can spend in this session */
  transactionLimit: number;
  /** Session duration in seconds */
  durationSeconds: number;
  /** Max number of transactions allowed, null = unlimited */
  maxTransactions: number | null;
}

export interface TransactionRecord {
  transactionId: string;
  amount: number;
  signature: string;
  description?: string;
  timestamp: Date;
}

export interface Session {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  transactionLimit: number;
  remainingLimit: number;
  maxTransactions: number | null;
  transactionsUsed: number;
  totalSpent: number;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
  transactions: TransactionRecord[];
}

// ─── API Response Types ─────────────────────────────────────────────────────

export interface SessionOpenResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  transactionLimit: string;
  transactionLimitReadable: string;
  remainingLimit: string;
  maxTransactions: number | null;
  transactionsUsed: number;
  expiresAt: string;
  durationSeconds: number;
}

export interface TransactResponse {
  receipt: {
    transactionId: string;
    amount: string;
    amountReadable: string;
    signature: string;
    description?: string;
  };
  session: {
    remainingLimit: string;
    remainingLimitReadable: string;
    transactionsUsed: number;
    expiresAt: string;
    secondsRemaining: number;
  };
}

export interface SessionStatusResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  transactionLimit: string;
  remainingLimit: string;
  remainingLimitReadable: string;
  transactionsUsed: number;
  maxTransactions: number | null;
  expiresAt: string;
  secondsRemaining: number;
  active: boolean;
}

export interface SessionCloseResponse {
  sessionId: string;
  closed: boolean;
  transactionsCompleted: number;
  totalSpent: string;
  totalSpentReadable: string;
  unusedLimit: string;
}

export interface GateCheckResult {
  allowed: boolean;
  result: GateResult;
  policy?: SessionPolicy;
}
