// Test session limit enforcement
const SERVER = "http://localhost:3000";

async function main() {
  // Open a session
  const res = await fetch(`${SERVER}/session/open/2`, { method: "POST" });
  const session = await res.json();
  console.log("Session opened:", session.sessionId);
  console.log("Limit:", session.transactionLimitReadable, "Max Tx:", session.maxTransactions);

  // Try a transaction that exceeds the limit
  console.log("\n--- Test: Exceed transaction limit ---");
  const bigTx = await fetch(`${SERVER}/session/transact/${session.sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.sessionId}`,
    },
    body: JSON.stringify({ amount: 6000000, description: "too much" }), // $6 > $5 limit
  });
  console.log("Status:", bigTx.status);
  console.log(await bigTx.json());

  // Try with wrong auth
  console.log("\n--- Test: Wrong auth ---");
  const badAuth = await fetch(`${SERVER}/session/transact/${session.sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer wrong_token",
    },
    body: JSON.stringify({ amount: 1000000 }),
  });
  console.log("Status:", badAuth.status);
  console.log(await badAuth.json());

  // Try missing amount
  console.log("\n--- Test: Missing amount ---");
  const noAmount = await fetch(`${SERVER}/session/transact/${session.sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.sessionId}`,
    },
    body: JSON.stringify({}),
  });
  console.log("Status:", noAmount.status);
  console.log(await noAmount.json());

  // Try valid transaction (gets 402 since we can't sign)
  console.log("\n--- Test: Valid transaction (expect 402 payment challenge) ---");
  const validTx = await fetch(`${SERVER}/session/transact/${session.sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.sessionId}`,
    },
    body: JSON.stringify({ amount: 1000000, description: "$1.00 test" }),
  });
  console.log("Status:", validTx.status);
  const wwwAuth = validTx.headers.get("www-authenticate");
  if (wwwAuth) console.log("Got WWW-Authenticate challenge (payment flow works!)");

  // Close and verify can't transact after
  console.log("\n--- Test: Close then transact ---");
  await fetch(`${SERVER}/session/close/${session.sessionId}`, { method: "POST" });
  const afterClose = await fetch(`${SERVER}/session/transact/${session.sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.sessionId}`,
    },
    body: JSON.stringify({ amount: 1000000 }),
  });
  console.log("Status:", afterClose.status);
  console.log(await afterClose.json());
}

main().catch(console.error);
