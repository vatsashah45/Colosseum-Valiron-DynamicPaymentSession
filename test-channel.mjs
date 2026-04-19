const BASE = "http://localhost:3000";

async function main() {
  // 1. Open channel
  const openRes = await fetch(`${BASE}/channel/open/1254`, { method: "POST" });
  const channel = await openRes.json();
  console.log("OPEN:", JSON.stringify(channel, null, 2));

  const sid = channel.sessionId;

  // 2. Consume $0.50
  const c1 = await fetch(`${BASE}/channel/consume/${sid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sid}` },
    body: JSON.stringify({ cost: 0.50, description: "price-feed-query" }),
  }).then((r) => r.json());
  console.log("\nCONSUME $0.50:", JSON.stringify(c1, null, 2));

  // 3. Consume $1.25
  const c2 = await fetch(`${BASE}/channel/consume/${sid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sid}` },
    body: JSON.stringify({ cost: 1.25, description: "trade-execution" }),
  }).then((r) => r.json());
  console.log("\nCONSUME $1.25:", JSON.stringify(c2, null, 2));

  // 4. Status
  const status = await fetch(`${BASE}/channel/status/${sid}`).then((r) => r.json());
  console.log("\nSTATUS:", JSON.stringify(status, null, 2));

  // 5. Settle
  const settle = await fetch(`${BASE}/channel/settle/${sid}`, { method: "POST" });
  console.log("\nSETTLE (HTTP", settle.status + "):");
  const settleBody = await settle.text();
  console.log(settleBody);
}

main().catch((e) => console.error("ERROR:", e.message));
