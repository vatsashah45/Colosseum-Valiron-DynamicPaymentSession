import { randomUUID } from "node:crypto";
import type { Session, SessionPolicy, TransactionRecord } from "./types.js";

export class SessionManager {
  private sessions = new Map<string, Session>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Sweep expired sessions every 60s
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /** Create a new session with trust-derived policy. */
  create(
    agentId: string,
    tier: string,
    score: number,
    riskLevel: string,
    policy: SessionPolicy,
  ): Session {
    const now = new Date();
    const session: Session = {
      sessionId: `sess_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      agentId,
      tier,
      score,
      riskLevel,
      transactionLimit: policy.transactionLimit,
      remainingLimit: policy.transactionLimit,
      maxTransactions: policy.maxTransactions,
      transactionsUsed: 0,
      totalSpent: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + policy.durationSeconds * 1000),
      active: true,
      transactions: [],
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  /** Get a session by ID. Returns undefined if not found. */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a transaction of the given amount can proceed.
   * Returns { ok: true } or { ok: false, reason, code }.
   */
  canTransact(
    sessionId: string,
    amount: number,
  ): { ok: true } | { ok: false; reason: string; code: number } {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { ok: false, reason: "Session not found.", code: 404 };
    }

    if (!session.active) {
      return { ok: false, reason: "Session has been closed.", code: 410 };
    }

    if (new Date() >= session.expiresAt) {
      session.active = false;
      return {
        ok: false,
        reason: "Payment session window has closed.",
        code: 410,
      };
    }

    if (
      session.maxTransactions !== null &&
      session.transactionsUsed >= session.maxTransactions
    ) {
      return {
        ok: false,
        reason: "Maximum transactions per session reached.",
        code: 429,
      };
    }

    if (amount > session.remainingLimit) {
      return {
        ok: false,
        reason: "Transaction amount exceeds remaining session limit.",
        code: 403,
      };
    }

    if (amount <= 0) {
      return { ok: false, reason: "Amount must be positive.", code: 400 };
    }

    return { ok: true };
  }

  /** Record a completed transaction against a session. */
  recordTransaction(
    sessionId: string,
    amount: number,
    signature: string,
    description?: string,
  ): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const record: TransactionRecord = {
      transactionId: `tx_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      amount,
      signature,
      description,
      timestamp: new Date(),
    };

    session.remainingLimit -= amount;
    session.totalSpent += amount;
    session.transactionsUsed += 1;
    session.transactions.push(record);

    return session;
  }

  /** Close a session early. */
  close(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.active = false;
    return session;
  }

  /** Remove expired sessions from memory. */
  private cleanup(): void {
    const now = new Date();
    for (const [id, session] of this.sessions) {
      if (now >= session.expiresAt || !session.active) {
        this.sessions.delete(id);
      }
    }
  }

  /** Stop the cleanup timer (for graceful shutdown). */
  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
