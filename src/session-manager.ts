import { randomUUID } from "node:crypto";
import type { Session, SessionPolicy, UsageRecord } from "./types.js";

export class SessionManager {
  private sessions = new Map<string, Session>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Sweep expired sessions every 60s
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /** Open a new payment channel with trust-derived policy. */
  create(
    agentId: string,
    tier: string,
    score: number,
    riskLevel: string,
    policy: SessionPolicy,
  ): Session {
    const now = new Date();
    const session: Session = {
      sessionId: `ch_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      agentId,
      tier,
      score,
      riskLevel,
      creditLine: policy.creditLine,
      consumed: 0,
      maxRequests: policy.maxRequests,
      requestCount: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + policy.durationSeconds * 1000),
      active: true,
      settled: false,
      usage: [],
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  /** Get a session by ID. Returns undefined if not found. */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a service request costing `cost` can be served.
   * Returns { ok: true } or { ok: false, reason, code }.
   */
  canConsume(
    sessionId: string,
    cost: number,
  ): { ok: true } | { ok: false; reason: string; code: number } {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return { ok: false, reason: "Channel not found.", code: 404 };
    }

    if (!session.active) {
      return { ok: false, reason: "Channel has been closed.", code: 410 };
    }

    if (new Date() >= session.expiresAt) {
      session.active = false;
      return {
        ok: false,
        reason: "Channel window has expired.",
        code: 410,
      };
    }

    if (
      session.maxRequests !== null &&
      session.requestCount >= session.maxRequests
    ) {
      return {
        ok: false,
        reason: "Maximum requests per channel reached.",
        code: 429,
      };
    }

    if (cost > session.creditLine - session.consumed) {
      return {
        ok: false,
        reason: "Cost exceeds remaining credit.",
        code: 403,
      };
    }

    if (cost <= 0) {
      return { ok: false, reason: "Cost must be positive.", code: 400 };
    }

    return { ok: true };
  }

  /** Record a consumed service request against the tab. */
  recordUsage(
    sessionId: string,
    cost: number,
    description?: string,
  ): Session {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Channel ${sessionId} not found`);

    const record: UsageRecord = {
      requestId: `req_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      cost,
      description,
      timestamp: new Date(),
    };

    session.consumed += cost;
    session.requestCount += 1;
    session.usage.push(record);

    return session;
  }

  /** Close a channel and mark for settlement. */
  close(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.active = false;
    return session;
  }

  /** Mark a channel as settled. */
  settle(sessionId: string, signature?: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.settled = true;
    session.settlementSignature = signature;
    return session;
  }

  /** Remove expired + settled sessions from memory. */
  private cleanup(): void {
    const now = new Date();
    for (const [id, session] of this.sessions) {
      if ((now >= session.expiresAt || !session.active) && session.settled) {
        this.sessions.delete(id);
      }
    }
  }

  /** Stop the cleanup timer (for graceful shutdown). */
  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
