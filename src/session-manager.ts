import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { Session, SessionPolicy, UsageRecord } from "./types.js";

// ─── Redis-backed Session Manager ──────────────────────────────────────────
// Sessions are stored as JSON in Redis with automatic TTL expiry.
// Falls back to in-memory Map when UPSTASH env vars are not set.

const SESSION_PREFIX = "session:";
const DEPOSIT_PREFIX = "deposit:";
const WALLET_PREFIX = "wallet:";
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
  private usedDeposits: Set<string> = new Set();
  private settlingLocks: Set<string> = new Set();

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
    // Track wallet → session mapping for unsettled debt lookups
    await this.addWalletSession(walletAddress, session.sessionId, policy.durationSeconds + TTL_BUFFER_SECONDS);
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
    // Remove from wallet index — no longer counts as debt
    await this.removeWalletSession(session.walletAddress, sessionId);
    return session;
  }

  /**
   * Prevent deposit signature replay: mark a deposit as used (single-use).
   * Returns false if the signature was already consumed by another channel.
   */
  async claimDeposit(depositSignature: string): Promise<boolean> {
    if (this.fallback) {
      if (this.usedDeposits.has(depositSignature)) return false;
      this.usedDeposits.add(depositSignature);
      return true;
    }
    // Redis SETNX: atomic "set if not exists" — returns true only for the first caller
    const key = `${DEPOSIT_PREFIX}${depositSignature}`;
    const result = await this.redis!.setnx(key, "1");
    if (result === 1) {
      // Set TTL so deposit keys don't persist forever (1 hour)
      await this.redis!.expire(key, 3600);
      return true;
    }
    return false;
  }

  /**
   * Acquire a settlement lock to prevent concurrent double-refund.
   * Returns false if another settle is already in progress.
   */
  async acquireSettleLock(sessionId: string): Promise<boolean> {
    if (this.fallback) {
      if (this.settlingLocks.has(sessionId)) return false;
      this.settlingLocks.add(sessionId);
      return true;
    }
    const key = `settling:${sessionId}`;
    const result = await this.redis!.setnx(key, "1");
    if (result === 1) {
      await this.redis!.expire(key, 120); // 2 min TTL safety net
      return true;
    }
    return false;
  }

  /** Release a settlement lock (called after settle completes or fails). */
  async releaseSettleLock(sessionId: string): Promise<void> {
    if (this.fallback) {
      this.settlingLocks.delete(sessionId);
      return;
    }
    await this.redis!.del(`settling:${sessionId}`);
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
    // Redis: look up wallet → session set, check each session
    const walletKey = `${WALLET_PREFIX}${walletAddress}`;
    const sessionIds = await this.redis!.smembers(walletKey);
    for (const sid of sessionIds) {
      const session = await this.get(sid);
      if (!session) {
        // Session expired from Redis TTL — clean up stale set entry
        await this.redis!.srem(walletKey, sid);
        continue;
      }
      if (
        !session.settled &&
        session.consumed > 0 &&
        (!session.active || new Date() >= session.expiresAt)
      ) {
        return { hasDebt: true, sessionId: session.sessionId, amount: session.consumed };
      }
    }
    return { hasDebt: false };
  }

  // ─── Wallet index helpers ──────────────────────────────────────────────

  /** Add a session to the wallet's session set in Redis. */
  private async addWalletSession(walletAddress: string, sessionId: string, ttlSeconds: number): Promise<void> {
    if (this.fallback) return; // In-memory iterates directly
    const walletKey = `${WALLET_PREFIX}${walletAddress}`;
    await this.redis!.sadd(walletKey, sessionId);
    // Extend TTL to cover the longest session
    await this.redis!.expire(walletKey, ttlSeconds);
  }

  /** Remove a session from the wallet's session set after settlement. */
  private async removeWalletSession(walletAddress: string, sessionId: string): Promise<void> {
    if (this.fallback) return;
    const walletKey = `${WALLET_PREFIX}${walletAddress}`;
    await this.redis!.srem(walletKey, sessionId);
  }
}
