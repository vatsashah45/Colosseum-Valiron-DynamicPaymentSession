import "dotenv/config";
import express from "express";
import { CONFIG, formatUSDC } from "./config.js";
import { gateAgent } from "./gate.js";
import { getUsdcBalance } from "./solana-rpc.js";
import { getEscrowAddress, verifyDeposit, sendRefund } from "./escrow.js";
import { SessionManager } from "./session-manager.js";
import type {
  PreflightResponse,
  ChannelOpenResponse,
  ConsumeResponse,
  ChannelStatusResponse,
  SettlementResponse,
} from "./types.js";

const app = express();
app.use(express.json());

// Cache preflight gate results for 5 minutes so /channel/open doesn't re-gate
const preflightCache = new Map<string, { gate: Awaited<ReturnType<typeof gateAgent>>; expires: number }>();

// CORS — needed when UI dev server (port 3000) calls backend directly (port 4000)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Payment-Receipt");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

const sessions = new SessionManager();

// ─── Health ─────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "dynamic-payment-channels",
    escrowAddress: getEscrowAddress(),
  });
});

// ─── Preflight: gate-only check ─────────────────────────────────────────────
// Returns tier, credit line, escrow address. No session created.

app.post("/channel/preflight/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const walletAddress = req.body?.walletAddress as string | undefined;

  if (!walletAddress) {
    res.status(400).json({
      error: "wallet_required",
      message: "walletAddress is required.",
    });
    return;
  }

  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    res.status(503).json({
      error: "escrow_not_configured",
      message: "Escrow wallet is not configured on the server.",
    });
    return;
  }

  try {
    console.log(`[preflight] Calling gateAgent(${agentId}) for wallet ${walletAddress}`);
    const gateStart = Date.now();
    const gate = await gateAgent(agentId);
    console.log(`[preflight] gateAgent returned in ${Date.now() - gateStart}ms`, { allowed: gate.allowed, score: gate.result?.score, tier: gate.result?.tier });

    if (!gate.allowed || !gate.policy) {
      res.status(403).json({
        error: "agent_rejected",
        score: gate.result.score,
        tier: gate.result.tier,
        riskLevel: gate.result.riskLevel,
        message: "Agent does not meet minimum trust threshold.",
      });
      return;
    }

    // Check for unsettled debt from previous channels
    const debt = await sessions.hasUnsettledDebt(walletAddress);
    if (debt.hasDebt) {
      res.status(403).json({
        error: "unsettled_debt",
        message: "This wallet has an unsettled channel. Settle it before opening a new one.",
        outstandingSession: debt.sessionId,
        outstandingAmount: String(debt.amount),
        outstandingReadable: formatUSDC(debt.amount!),
      });
      return;
    }

    // Verify wallet has enough USDC to cover the credit line
    let walletBalance: bigint;
    try {
      walletBalance = await getUsdcBalance(walletAddress);
    } catch (err) {
      console.error("Balance check error:", err);
      res.status(502).json({
        error: "balance_check_failed",
        message: "Could not verify wallet balance. Please try again.",
      });
      return;
    }

    if (walletBalance < BigInt(gate.policy.creditLine)) {
      res.status(402).json({
        error: "insufficient_balance",
        message: "Wallet does not have enough USDC to cover the credit line deposit.",
        requiredBalance: String(gate.policy.creditLine),
        requiredReadable: formatUSDC(gate.policy.creditLine),
        actualBalance: String(walletBalance),
        actualReadable: formatUSDC(Number(walletBalance)),
        tier: gate.result.tier,
        score: gate.result.score,
      });
      return;
    }

    // Cache gate result so /channel/open can reuse it (5 min TTL)
    const cacheKey = `${walletAddress}:${agentId}`;
    preflightCache.set(cacheKey, { gate, expires: Date.now() + 5 * 60_000 });

    const response: PreflightResponse = {
      agentId,
      tier: gate.result.tier,
      score: gate.result.score,
      riskLevel: gate.result.riskLevel,
      creditLine: String(gate.policy.creditLine),
      creditLineReadable: formatUSDC(gate.policy.creditLine),
      maxRequests: gate.policy.maxRequests,
      durationSeconds: gate.policy.durationSeconds,
      escrowAddress,
    };

    res.json(response);
  } catch (err) {
    console.error("Gate error:", err);
    const e = err as { statusCode?: number; message?: string };
    if (e?.statusCode === 404) {
      res.status(404).json({
        error: "agent_rejected",
        message: "Agent not registered with Valiron on Solana.",
      });
      return;
    }
    res.status(502).json({
      error: "gate_unavailable",
      message: "Could not reach Valiron trust service.",
    });
  }
});

// ─── Open Channel ───────────────────────────────────────────────────────────
// Verify escrow deposit on-chain → create channel.

app.post("/channel/open/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const walletAddress = req.body?.walletAddress as string | undefined;
  const depositSignature = req.body?.depositSignature as string | undefined;

  if (!walletAddress) {
    res.status(400).json({
      error: "wallet_required",
      message: "walletAddress is required to open a channel.",
    });
    return;
  }

  if (!depositSignature) {
    res.status(400).json({
      error: "deposit_required",
      message: "depositSignature is required. Use /channel/preflight/:agentId first to get escrow details, then deposit USDC.",
    });
    return;
  }

  const escrowAddress = getEscrowAddress();
  if (!escrowAddress) {
    res.status(503).json({
      error: "escrow_not_configured",
      message: "Escrow wallet is not configured on the server.",
    });
    return;
  }

  try {
    // Use cached gate result from preflight if available (avoids re-gating after deposit)
    const cacheKey = `${walletAddress}:${agentId}`;
    const cached = preflightCache.get(cacheKey);
    let gate;
    if (cached && cached.expires > Date.now() && cached.gate.allowed) {
      gate = cached.gate;
      preflightCache.delete(cacheKey);
      console.log(`Using cached gate result for ${cacheKey}: score=${gate.result.score} tier=${gate.result.tier}`);
    } else {
      gate = await gateAgent(agentId);
    }

    if (!gate.allowed || !gate.policy) {
      res.status(403).json({
        error: "agent_rejected",
        score: gate.result.score,
        tier: gate.result.tier,
        riskLevel: gate.result.riskLevel,
        message: "Agent does not meet minimum trust threshold.",
      });
      return;
    }

    // Prevent deposit signature replay — each deposit can only open one channel
    const claimed = await sessions.claimDeposit(depositSignature);
    if (!claimed) {
      res.status(409).json({
        error: "deposit_already_used",
        message: "This deposit signature has already been used to open a channel.",
      });
      return;
    }

    // Verify the escrow deposit on-chain
    const deposit = await verifyDeposit(
      depositSignature,
      gate.policy.creditLine,
      walletAddress,
    );

    if (!deposit.verified) {
      res.status(402).json({
        error: "deposit_invalid",
        message: deposit.error || "Escrow deposit could not be verified.",
        requiredAmount: String(gate.policy.creditLine),
        requiredReadable: formatUSDC(gate.policy.creditLine),
        escrowAddress,
      });
      return;
    }

    const session = await sessions.create(
      agentId,
      gate.result.tier,
      gate.result.score,
      gate.result.riskLevel,
      gate.policy,
      walletAddress,
      depositSignature,
    );

    const response: ChannelOpenResponse = {
      sessionId: session.sessionId,
      agentId: session.agentId,
      tier: session.tier,
      score: session.score,
      riskLevel: session.riskLevel,
      creditLine: String(session.creditLine),
      creditLineReadable: formatUSDC(session.creditLine),
      maxRequests: session.maxRequests,
      expiresAt: session.expiresAt.toISOString(),
      durationSeconds: Math.round(
        (session.expiresAt.getTime() - session.createdAt.getTime()) / 1000,
      ),
      depositConfirmed: true,
      depositSignature,
      escrowAddress,
    };

    res.json(response);
  } catch (err) {
    console.error("Open error:", err);
    const e = err as { statusCode?: number };
    if (e?.statusCode === 404) {
      res.status(404).json({
        error: "agent_rejected",
        message: "Agent not registered with Valiron on Solana.",
      });
      return;
    }
    res.status(502).json({
      error: "gate_unavailable",
      message: "Could not reach Valiron trust service.",
    });
  }
});

// ─── Consume ────────────────────────────────────────────────────────────────
// Deduct from credit line. Instant 200. No payment friction.

app.post("/channel/consume/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const auth = req.headers.authorization;

  if (!auth || auth !== `Bearer ${sessionId}`) {
    res.status(401).json({ error: "unauthorized", message: "Invalid channel token." });
    return;
  }

  const rawCost = Number(req.body?.cost);
  const description = req.body?.description as string | undefined;

  if (!rawCost || isNaN(rawCost)) {
    res.status(400).json({ error: "bad_request", message: "cost is required (USDC dollar amount, e.g. 0.50)." });
    return;
  }

  // Convert dollar amount to base units (6 decimals)
  const cost = Math.round(rawCost * 1_000_000);

  // Validate against channel constraints
  const check = await sessions.canConsume(sessionId, cost);
  if (!check.ok) {
    const session = await sessions.get(sessionId);
    res.status(check.code).json({
      error:
        check.code === 410 ? "channel_expired" :
        check.code === 429 ? "max_requests" :
        check.code === 403 ? "credit_exceeded" :
        "channel_error",
      message: check.reason,
      ...(check.code === 403 && session
        ? { requested: String(cost), remaining: String(session.creditLine - session.consumed) }
        : {}),
    });
    return;
  }

  // Record usage — no payment here, just a tab
  const session = await sessions.recordUsage(sessionId, cost, description);
  const remaining = session.creditLine - session.consumed;

  const response: ConsumeResponse = {
    requestId: session.usage.at(-1)!.requestId,
    cost: String(cost),
    costReadable: formatUSDC(cost),
    ...(description ? { description } : {}),
    session: {
      consumed: String(session.consumed),
      consumedReadable: formatUSDC(session.consumed),
      remaining: String(remaining),
      remainingReadable: formatUSDC(remaining),
      requestCount: session.requestCount,
      maxRequests: session.maxRequests,
      secondsRemaining: Math.max(
        0,
        Math.round((session.expiresAt.getTime() - Date.now()) / 1000),
      ),
    },
  };

  res.json(response);
});

// ─── Channel Status ─────────────────────────────────────────────────────────

app.get("/channel/status/:sessionId", async (req, res) => {
  const session = await sessions.get(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: "not_found", message: "Channel not found." });
    return;
  }

  const now = Date.now();
  const isExpired = now >= session.expiresAt.getTime();
  if (isExpired && session.active) {
    session.active = false;
    await sessions.close(session.sessionId);
  }

  const remaining = session.creditLine - session.consumed;

  const response: ChannelStatusResponse = {
    sessionId: session.sessionId,
    agentId: session.agentId,
    tier: session.tier,
    creditLine: String(session.creditLine),
    creditLineReadable: formatUSDC(session.creditLine),
    consumed: String(session.consumed),
    consumedReadable: formatUSDC(session.consumed),
    remaining: String(remaining),
    remainingReadable: formatUSDC(remaining),
    requestCount: session.requestCount,
    maxRequests: session.maxRequests,
    expiresAt: session.expiresAt.toISOString(),
    secondsRemaining: Math.max(
      0,
      Math.round((session.expiresAt.getTime() - now) / 1000),
    ),
    active: session.active,
    settled: session.settled,
  };

  res.json(response);
});

// ─── Settle & Close ─────────────────────────────────────────────────────────
// Close the channel. Provider keeps consumed portion from escrow.
// Server refunds unused USDC back to the agent's wallet.

app.post("/channel/settle/:sessionId", async (req, res) => {
  const session = await sessions.get(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: "not_found", message: "Channel not found." });
    return;
  }

  if (session.settled) {
    res.status(409).json({ error: "already_settled", message: "Channel already settled." });
    return;
  }

  // Acquire settlement lock to prevent concurrent double-refund
  const lockAcquired = await sessions.acquireSettleLock(session.sessionId);
  if (!lockAcquired) {
    res.status(409).json({ error: "settlement_in_progress", message: "Settlement is already in progress." });
    return;
  }

  try {
  // Re-check settled state after acquiring lock (another request may have completed)
  const freshSession = await sessions.get(session.sessionId);
  if (freshSession?.settled) {
    await sessions.releaseSettleLock(session.sessionId);
    res.status(409).json({ error: "already_settled", message: "Channel already settled." });
    return;
  }

  // Close the channel
  await sessions.close(session.sessionId);

  const remaining = session.creditLine - session.consumed;

  // If nothing was consumed, full refund
  // Attempt refund if there's unused credit
  let refundSignature: string | undefined;
  let refundWarning: string | undefined;
  const refundAmount = session.consumed === 0 ? session.creditLine : remaining;

  if (refundAmount > 0) {
    const refundResult = await sendRefund(session.walletAddress, refundAmount);
    if ("error" in refundResult) {
      console.error("Refund failed (settling anyway):", refundResult.error);
      refundWarning = refundResult.error;
    } else {
      refundSignature = refundResult.signature;
    }
  }

  // Always mark as settled — even if refund failed
  await sessions.settle(session.sessionId, refundSignature);

  const response: SettlementResponse = {
    sessionId: session.sessionId,
    settled: true,
    totalConsumed: String(session.consumed),
    totalConsumedReadable: formatUSDC(session.consumed),
    requestsServed: session.requestCount,
    unusedCredit: String(refundAmount),
    unusedCreditReadable: formatUSDC(refundAmount),
    ...(refundSignature ? {
      refundAmount: String(refundAmount),
      refundReadable: formatUSDC(refundAmount),
      refundSignature,
    } : {}),
    ...(refundWarning ? { refundWarning } : {}),
  };
  res.json(response);

  } finally {
    await sessions.releaseSettleLock(session.sessionId);
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(CONFIG.port, () => {
  console.log(`Dynamic Payment Channels server listening on port ${CONFIG.port}`);
  console.log(`  Network:   ${CONFIG.solana.network}`);
  console.log(`  Escrow:    ${getEscrowAddress() || "(not set — add ESCROW_PRIVATE_KEY)"}`);
  console.log(`  Valiron:   ${CONFIG.valiron.baseUrl}`);
  console.log(`  Min Score: ${CONFIG.valiron.minScore}`);
});

export default app;
