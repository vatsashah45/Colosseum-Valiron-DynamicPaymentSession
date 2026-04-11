import "dotenv/config";
import express from "express";
import { Mppx } from "@solana/mpp/server";
import { CONFIG, formatUSDC } from "./config.js";
import { gateAgent } from "./gate.js";
import { createMppx } from "./payment.js";
import { SessionManager } from "./session-manager.js";
import type {
  ChannelOpenResponse,
  ConsumeResponse,
  ChannelStatusResponse,
  SettlementResponse,
} from "./types.js";

const app = express();
app.use(express.json());

const sessions = new SessionManager();
const mppx = createMppx();

// ─── Health ─────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dynamic-payment-channels" });
});

// ─── Open Channel ───────────────────────────────────────────────────────────
// Gate check → create channel with trust-derived credit line. No payment yet.

app.post("/channel/open/:agentId", async (req, res) => {
  const { agentId } = req.params;

  try {
    const gate = await gateAgent(agentId);

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

    const session = sessions.create(
      agentId,
      gate.result.tier,
      gate.result.score,
      gate.result.riskLevel,
      gate.policy,
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
    };

    res.json(response);
  } catch (err) {
    console.error("Gate error:", err);
    res.status(502).json({
      error: "gate_unavailable",
      message: "Could not reach Valiron trust service.",
    });
  }
});

// ─── Consume ────────────────────────────────────────────────────────────────
// Deduct from credit line. Instant 200. No payment friction.

app.post("/channel/consume/:sessionId", (req, res) => {
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
  const check = sessions.canConsume(sessionId, cost);
  if (!check.ok) {
    const session = sessions.get(sessionId);
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
  const session = sessions.recordUsage(sessionId, cost, description);
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

app.get("/channel/status/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: "not_found", message: "Channel not found." });
    return;
  }

  const now = Date.now();
  const isExpired = now >= session.expiresAt.getTime();
  if (isExpired) session.active = false;

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
// Close the channel and issue ONE settlement charge for total consumed.

app.post("/channel/settle/:sessionId", async (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: "not_found", message: "Channel not found." });
    return;
  }

  if (session.settled) {
    res.status(409).json({ error: "already_settled", message: "Channel already settled." });
    return;
  }

  // Close the channel
  sessions.close(session.sessionId);

  const remaining = session.creditLine - session.consumed;

  // If nothing was consumed, no payment needed
  if (session.consumed === 0) {
    sessions.settle(session.sessionId);
    const response: SettlementResponse = {
      sessionId: session.sessionId,
      settled: true,
      totalConsumed: "0",
      totalConsumedReadable: "$0.00",
      requestsServed: 0,
      unusedCredit: String(session.creditLine),
      unusedCreditReadable: formatUSDC(session.creditLine),
    };
    res.json(response);
    return;
  }

  // Issue ONE settlement charge via MPP for total consumed
  const chargeHandler = Mppx.toNodeListener(
    mppx.solana.charge({
      amount: String(session.consumed),
      currency: CONFIG.solana.usdcMint,
      description: `Settlement: ${session.requestCount} requests on channel ${session.sessionId}`,
    }),
  );

  const result = await chargeHandler(req, res);

  if (result.status === 402) {
    // 402 with payment challenge — agent needs to pay this ONE charge
    // Don't mark as settled yet; they'll call again with receipt
    // Re-open channel so they can retry settlement
    session.active = false; // keep closed, but not settled
    return;
  }

  // Payment verified — mark settled
  sessions.settle(session.sessionId);

  const response: SettlementResponse = {
    sessionId: session.sessionId,
    settled: true,
    totalConsumed: String(session.consumed),
    totalConsumedReadable: formatUSDC(session.consumed),
    requestsServed: session.requestCount,
    unusedCredit: String(remaining),
    unusedCreditReadable: formatUSDC(remaining),
  };

  res.json(response);
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(CONFIG.port, () => {
  console.log(`Dynamic Payment Channels server listening on port ${CONFIG.port}`);
  console.log(`  Network:   ${CONFIG.solana.network}`);
  console.log(`  Recipient: ${CONFIG.solana.recipient || "(not set)"}`);
  console.log(`  Valiron:   ${CONFIG.valiron.baseUrl}`);
  console.log(`  Min Score: ${CONFIG.valiron.minScore}`);
});

export default app;
