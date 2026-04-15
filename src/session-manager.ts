import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { Session, SessionPolicy, UsageRecord } from "./types.js";

// ─── Redis-backed Session Manager ──────────────────────────────────────────
// Sessions are stored as JSON in Redis with automatic TTL expiry.
// Falls back to in-memory Map when UPSTASH env vars are not set.

const SESSION_PREFIX = "session:";
// Extra buffer beyond channel expiry so settled sessions remain queryable
const TTL_BUFFER_SECONDS = 300;

/** Serializable session shape for Redis (Dates → ISO strings). */
interface SessionData {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  creditLine: number;
  consumed: number;
  maxRequests: number | null;
  requestCount: number;
  createdAt: string;
  expiresAt: string;
  active: boolean;
  settled: boolean;
  settlementSignature?: string;
  walletAddress: string;
  depositSignature: string;
  usage: {
    requestId: string;
    cost: number;
    description?: string;
    timestamp: string;
  }[];
}

function toSessionData(session: Session): SessionData {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    usage: session.usage.map((u) => ({
      ...u,
      timestamp: u.timestamp.toISOString(),
    })),
  };
}

function fromSessionData(data: SessionData): Session {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    expiresAt: new Date(data.expiresAt),
    usage: data.usage.map((u) => ({
      ...u,
      timestamp: new Date(u.timestamp),
    })),
  };
}

export class SessionManager {
  private redis: Redis | null = null;
  private fallback: Map<string, Session> | null = null;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      this.redis = new Redis({ url, token });
      console.log("  Sessions: Redis (persistent)");
    } else {
      this.fallback = new Map<string, Session>();
      console.log(
        "  Sessions: In-memory (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for persistence)",
      );
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  private key(sessionId: string): string {
    return `${SESSION_PREFIX}${sessionId}`;
  }

  private async save(session: Session): Promise<void> {
    if (this.fallback) {
      this.fallback.set(session.sessionId, session);
      return;
    }
    const ttl = Math.max(
      60,
      Math.round((session.expiresAt.getTime() - Date.now()) / 1000) + TTL_BUFFER_SECONDS,
    );
    await this.redis!.set(this.key(session.sessionId), JSON.stringify(toSessionData(session)), {
      ex: ttl,
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /** Open a new payment channel with trust-derived policy. */
  async create(
    agentId: string,
    tier: string,
    score: number,
    riskLevel: string,
    policy: SessionPolicy,
    walletAddress: string,
    depositSignature: string,
  ): Promise<Session> {
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
      walletAddress,
      depositSignature,
      usage: [],
    };

    await this.save(session);
    return session;
  }

  /** Get a session by ID. Returns undefined if not found. */
  async get(sessionId: string): Promise<Session | undefined> {
    if (this.fallback) {
      return this.fallback.get(sessionId);
    }
    const raw = await this.redis!.get<string>(this.key(sessionId));
    if (!raw) return undefined;
    const data: SessionData = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as SessionData);
    return fromSessionData(data);
  }

  /**
   * Check if a service request costing `cost` can be served.
   * Returns { ok: true } or { ok: false, reason, code }.
   */
  async canConsume(
    sessionId: string,
    cost: number,
  ): Promise<{ ok: true } | { ok: false; reason: string; code: number }> {
    const session = await this.get(sessionId);

    if (!session) {
      return { ok: false, reason: "Channel not found.", code: 404 };
    }

    if (!session.active) {
      return { ok: false, reason: "Channel has been closed.", code: 410 };
    }

    if (new Date() >= session.expiresAt) {
      session.active = false;
      await this.save(session);
      return { ok: false, reason: "Channel window has expired.", code: 410 };
    }

    if (session.maxRequests !== null && session.requestCount >= session.maxRequests) {
      return { ok: false, reason: "Maximum requests per channel reached.", code: 429 };
    }

    if (cost > session.creditLine - session.consumed) {
      return { ok: false, reason: "Cost exceeds remaining credit.", code: 403 };
    }

    if (cost <= 0) {
      return { ok: false, reason: "Cost must be positive.", code: 400 };
    }

    return { ok: true };
  }

  /** Record a consumed service request against the tab. */
  async recordUsage(sessionId: string, cost: number, description?: string): Promise<Session> {
    const session = await this.get(sessionId);
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

    await this.save(session);
    return session;
  }

  /** Close a channel and mark for settlement. */
  async close(sessionId: string): Promise<Session | undefined> {
    const session = await this.get(sessionId);
    if (!session) return undefined;
    session.active = false;
    await this.save(session);
    return session;
  }

  /** Mark a channel as settled. */
  async settle(sessionId: string, signature?: string): Promise<Session | undefined> {
    const session = await this.get(sessionId);
    if (!session) return undefined;
    session.settled = true;
    session.settlementSignature = signature;
    await this.save(session);
    return session;
  }

  /** No-op for Redis (TTL handles cleanup). Kept for API compat. */
  destroy(): void {
    // Redis TTL handles expiry automatically
  }

  /**
   * Check if a wallet has any expired-but-unsettled channels.
   * Used to block new channel opens from wallets with outstanding debt.
   */
  async hasUnsettledDebt(walletAddress: string): Promise<{ hasDebt: boolean; sessionId?: string; amount?: number }> {
    if (this.fallback) {
      for (const session of this.fallback.values()) {
        if (
          session.walletAddress === walletAddress &&
          !session.settled &&
          session.consumed > 0 &&
          (!session.active || new Date() >= session.expiresAt)
        ) {
          return { hasDebt: true, sessionId: session.sessionId, amount: session.consumed };
        }
      }
      return { hasDebt: false };
    }
    // For Redis: we'd need a secondary index (wallet → sessions).
    // For now, this is handled by the in-memory fallback.
    // In production, use a Redis sorted set or separate key per wallet.
    return { hasDebt: false };
  }
}
