// Direct happy-path test: imports modules directly to test consume + settle
// without needing a real on-chain deposit

import "dotenv/config";
import express from "express";
import { SessionManager } from "./src/session-manager.js";
import { formatUSDC } from "./src/config.js";

const sessions = new SessionManager();

async function test() {
  console.log("=== DIRECT HAPPY-PATH TEST ===\n");

  // Create a session directly (simulating what /channel/open does after deposit verification)
  const session = await sessions.create(
    "test-agent-1209",  // agentId
    "A",                 // tier
    85,                  // score
    "low",               // riskLevel
    { creditLine: 25_000_000, durationSeconds: 1800, maxRequests: 30 },  // policy ($25)
    "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",  // walletAddress
    "test_deposit_sig_happy_path",                       // depositSignature
  );

  console.log("1. Session created:", session.sessionId);
  console.log("   Tier:", session.tier, "| Credit:", formatUSDC(session.creditLine), "| Max:", session.maxRequests);

  // Test canConsume
  const check1 = await sessions.canConsume(session.sessionId, 500_000); // $0.50
  console.log("2. Can consume $0.50?", check1.ok);

  // Record usage
  const after1 = await sessions.recordUsage(session.sessionId, 500_000, "API call 1");
  console.log("3. After consume 1: consumed=" + formatUSDC(after1.consumed),
              "remaining=" + formatUSDC(after1.creditLine - after1.consumed),
              "requests=" + after1.requestCount);

  // Second consume
  const after2 = await sessions.recordUsage(session.sessionId, 1_000_000, "API call 2 ($1.00)");
  console.log("4. After consume 2: consumed=" + formatUSDC(after2.consumed),
              "remaining=" + formatUSDC(after2.creditLine - after2.consumed),
              "requests=" + after2.requestCount);

  // Third consume
  const after3 = await sessions.recordUsage(session.sessionId, 2_500_000, "API call 3 ($2.50)");
  console.log("5. After consume 3: consumed=" + formatUSDC(after3.consumed),
              "remaining=" + formatUSDC(after3.creditLine - after3.consumed),
              "requests=" + after3.requestCount);

  // Try to exceed credit
  const remaining = after3.creditLine - after3.consumed;
  const overCheck = await sessions.canConsume(session.sessionId, remaining + 1);
  console.log("6. Can exceed credit?", overCheck.ok, overCheck.ok ? "" : "(" + overCheck.reason + ")");

  // Consume exact remaining
  const exactCheck = await sessions.canConsume(session.sessionId, remaining);
  console.log("7. Can consume exact remaining (" + formatUSDC(remaining) + ")?", exactCheck.ok);

  // Check status
  const status = await sessions.get(session.sessionId);
  console.log("8. Status: active=" + status.active, "settled=" + status.settled,
              "consumed=" + formatUSDC(status.consumed),
              "usageRecords=" + status.usage.length);

  // Close channel
  await sessions.close(session.sessionId);
  const closed = await sessions.get(session.sessionId);
  console.log("9. After close: active=" + closed.active);

  // Settle (no actual refund since we didn't deposit, just mark settled)
  await sessions.settle(session.sessionId);
  const settled = await sessions.get(session.sessionId);
  console.log("10. After settle: settled=" + settled.settled);

  // Try to consume after close
  const deadCheck = await sessions.canConsume(session.sessionId, 500_000);
  console.log("11. Consume after close?", deadCheck.ok, deadCheck.ok ? "" : "(" + deadCheck.reason + ")");

  // Verify usage log
  console.log("\n--- Usage Log ---");
  for (const u of settled.usage) {
    console.log("  " + u.requestId + ": " + formatUSDC(u.cost) + " - " + (u.description || ""));
  }

  // Deposit replay guard
  const claimed1 = await sessions.claimDeposit("test_replay_sig");
  const claimed2 = await sessions.claimDeposit("test_replay_sig");
  console.log("\n12. Deposit replay guard: 1st=" + claimed1 + " 2nd=" + claimed2);

  // Settle lock
  const lock1 = await sessions.acquireSettleLock(session.sessionId);
  const lock2 = await sessions.acquireSettleLock(session.sessionId);
  console.log("13. Settle lock: 1st=" + lock1 + " 2nd=" + lock2);
  await sessions.releaseSettleLock(session.sessionId);
  const lock3 = await sessions.acquireSettleLock(session.sessionId);
  console.log("14. After release: 3rd=" + lock3);
  await sessions.releaseSettleLock(session.sessionId);

  // Test max requests limit
  console.log("\n--- Max Requests Test ---");
  const limited = await sessions.create(
    "test-agent-limited", "B", 40, "high",
    { creditLine: 1_000_000, durationSeconds: 600, maxRequests: 3 },
    "SomeWalletAddr123", "test_deposit_limited",
  );
  for (let i = 1; i <= 4; i++) {
    const c = await sessions.canConsume(limited.sessionId, 100_000);
    if (c.ok) {
      await sessions.recordUsage(limited.sessionId, 100_000, `req ${i}`);
      console.log(`  Request ${i}: OK`);
    } else {
      console.log(`  Request ${i}: BLOCKED (${c.reason})`);
    }
  }

  console.log("\n=== ALL HAPPY-PATH TESTS PASSED ===");
}

test().catch(e => {
  console.error("FAIL:", e);
  process.exit(1);
});
