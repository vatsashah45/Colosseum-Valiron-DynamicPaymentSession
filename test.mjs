// Quick test script for the session server
const SERVER = "http://localhost:3000";

async function test() {
  // 1. Health
  console.log("=== HEALTH ===");
  const health = await fetch(`${SERVER}/health`);
  console.log(await health.json());

  // 2. Open session for agent 1 (Solana)
  console.log("\n=== OPEN SESSION (agent 1) ===");
  const openRes = await fetch(`${SERVER}/session/open/1`, { method: "POST" });
  console.log("Status:", openRes.status);
  const openData = await openRes.json();
  console.log(JSON.stringify(openData, null, 2));

  if (openRes.status !== 200) {
    console.log("\nAgent 1 rejected or error, trying agent 2...");
    const openRes2 = await fetch(`${SERVER}/session/open/2`, { method: "POST" });
    console.log("Status:", openRes2.status);
    const openData2 = await openRes2.json();
    console.log(JSON.stringify(openData2, null, 2));

    if (openRes2.status === 200) {
      await testSession(openData2);
    }
    return;
  }

  await testSession(openData);
}

async function testSession(session) {
  const sessionId = session.sessionId;

  // 3. Check status
  console.log("\n=== SESSION STATUS ===");
  const statusRes = await fetch(`${SERVER}/session/status/${sessionId}`);
  console.log(JSON.stringify(await statusRes.json(), null, 2));

  // 4. Try transacting (will get 402 since we can't actually sign)
  console.log("\n=== TRANSACT (expect 402 or payment flow) ===");
  const txRes = await fetch(`${SERVER}/session/transact/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionId}`,
    },
    body: JSON.stringify({ amount: 1000000, description: "test tx" }),
  });
  console.log("Status:", txRes.status);
  const txHeaders = Object.fromEntries(txRes.headers.entries());
  if (txHeaders["www-authenticate"]) {
    console.log("WWW-Authenticate:", txHeaders["www-authenticate"].slice(0, 120) + "...");
  }

  // 5. Close session
  console.log("\n=== CLOSE SESSION ===");
  const closeRes = await fetch(`${SERVER}/session/close/${sessionId}`, {
    method: "POST",
  });
  console.log(JSON.stringify(await closeRes.json(), null, 2));

  // 6. Verify closed session returns error
  console.log("\n=== STATUS AFTER CLOSE ===");
  const postClose = await fetch(`${SERVER}/session/status/${sessionId}`);
  console.log(JSON.stringify(await postClose.json(), null, 2));
}

test().catch(console.error);
