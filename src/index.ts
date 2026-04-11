import "dotenv/config";
import express from "express";
import { Mppx } from "@solana/mpp/server";
import { CONFIG, formatUSDC } from "./config.js";
import { gateAgent } from "./gate.js";
import { createMppx } from "./payment.js";
import { SessionManager } from "./session-manager.js";
import type {
  SessionOpenResponse,
  SessionStatusResponse,
  SessionCloseResponse,
} from "./types.js";

const app = express();
app.use(express.json());

const sessions = new SessionManager();
const mppx = createMppx();

// ─── Health ─────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "dynamic-payment-sessions" });
});

// ─── Open Session ───────────────────────────────────────────────────────────

app.post("/session/open/:agentId", async (req, res) => {
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

    const response: SessionOpenResponse = {
      sessionId: session.sessionId,
      agentId: session.agentId,
      tier: session.tier,
      score: session.score,
      riskLevel: session.riskLevel,
      transactionLimit: String(session.transactionLimit),
      transactionLimitReadable: formatUSDC(session.transactionLimit),
      remainingLimit: String(session.remainingLimit),
      maxTransactions: session.maxTransactions,
      transactionsUsed: 0,
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

// ─── Transact ───────────────────────────────────────────────────────────────

app.post("/session/transact/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const auth = req.headers.authorization;

  if (!auth || auth !== `Bearer ${sessionId}`) {
    res.status(401).json({ error: "unauthorized", message: "Invalid session token." });
    return;
  }

  const amount = Number(req.body?.amount);
  const description = req.body?.description as string | undefined;

  if (!amount || isNaN(amount)) {
    res.status(400).json({ error: "bad_request", message: "amount is required (base units)." });
    return;
  }

  // Validate session constraints before touching Solana
  const check = sessions.canTransact(sessionId, amount);
  if (!check.ok) {
    const session = sessions.get(sessionId);
    res.status(check.code).json({
      error:
        check.code === 410 ? "session_expired" :
        check.code === 429 ? "max_transactions" :
        check.code === 403 ? "limit_exceeded" :
        "session_error",
      message: check.reason,
      ...(check.code === 403 && session
        ? { requested: String(amount), remainingLimit: String(session.remainingLimit) }
        : {}),
      ...(check.code === 429 && session
        ? { maxTransactions: session.maxTransactions, transactionsUsed: session.transactionsUsed }
        : {}),
    });
    return;
  }

  // Run the @solana/mpp charge flow
  const chargeHandler = Mppx.toNodeListener(
    mppx.solana.charge({
      amount: String(amount),
      currency: CONFIG.solana.usdcMint,
      description,
    }),
  );

  const result = await chargeHandler(req, res);

  if (result.status === 402) {
    // 402 response already sent by toNodeListener
    return;
  }

  // Payment verified — record the transaction
  // Extract signature from the receipt reference
  const receiptHeader = res.getHeader("payment-receipt") as string | undefined;
  let signature = "verified";
  if (receiptHeader) {
    // Receipt header contains base64-encoded JSON with reference field
    try {
      const receiptData = JSON.parse(
        Buffer.from(receiptHeader.replace(/^Payment /, ""), "base64").toString(),
      );
      signature = receiptData.reference || "verified";
    } catch {
      // fallback
    }
  }

  const session = sessions.recordTransaction(sessionId, amount, signature, description);

  const responseBody = {
    receipt: {
      transactionId: session.transactions.at(-1)!.transactionId,
      amount: String(amount),
      amountReadable: formatUSDC(amount),
      signature,
      ...(description ? { description } : {}),
    },
    session: {
      remainingLimit: String(session.remainingLimit),
      remainingLimitReadable: formatUSDC(session.remainingLimit),
      transactionsUsed: session.transactionsUsed,
      expiresAt: session.expiresAt.toISOString(),
      secondsRemaining: Math.max(
        0,
        Math.round((session.expiresAt.getTime() - Date.now()) / 1000),
      ),
    },
  };

  // withReceipt attaches the Payment-Receipt header to the response
  result.withReceipt(
    new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

// ─── Session Status ─────────────────────────────────────────────────────────

app.get("/session/status/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: "not_found", message: "Session not found." });
    return;
  }

  const now = Date.now();
  const isExpired = now >= session.expiresAt.getTime();
  if (isExpired) session.active = false;

  const response: SessionStatusResponse = {
    sessionId: session.sessionId,
    agentId: session.agentId,
    tier: session.tier,
    transactionLimit: String(session.transactionLimit),
    remainingLimit: String(session.remainingLimit),
    remainingLimitReadable: formatUSDC(session.remainingLimit),
    transactionsUsed: session.transactionsUsed,
    maxTransactions: session.maxTransactions,
    expiresAt: session.expiresAt.toISOString(),
    secondsRemaining: Math.max(
      0,
      Math.round((session.expiresAt.getTime() - now) / 1000),
    ),
    active: session.active,
  };

  res.json(response);
});

// ─── Close Session ──────────────────────────────────────────────────────────

app.post("/session/close/:sessionId", (req, res) => {
  const session = sessions.close(req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: "not_found", message: "Session not found." });
    return;
  }

  const response: SessionCloseResponse = {
    sessionId: session.sessionId,
    closed: true,
    transactionsCompleted: session.transactionsUsed,
    totalSpent: String(session.totalSpent),
    totalSpentReadable: formatUSDC(session.totalSpent),
    unusedLimit: String(session.remainingLimit),
  };

  res.json(response);
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(CONFIG.port, () => {
  console.log(`Dynamic Payment Sessions server listening on port ${CONFIG.port}`);
  console.log(`  Network:   ${CONFIG.solana.network}`);
  console.log(`  Recipient: ${CONFIG.solana.recipient || "(not set)"}`);
  console.log(`  Valiron:   ${CONFIG.valiron.baseUrl}`);
  console.log(`  Min Score: ${CONFIG.valiron.minScore}`);
});

export default app;
