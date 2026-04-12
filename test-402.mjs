// Test the 402 challenge to verify WWW-Authenticate header format
async function main() {
  // Open a channel
  const openRes = await fetch("http://localhost:3000/channel/open/1209", { method: "POST" });
  const channel = await openRes.json();
  console.log("OPEN:", channel.sessionId, "score:", channel.score, "tier:", channel.tier);
  
  if (!channel.sessionId) {
    console.log("REJECTED:", channel);
    return;
  }

  // Consume $0.01
  const c1 = await fetch(`http://localhost:3000/channel/consume/${channel.sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channel.sessionId}`,
    },
    body: JSON.stringify({ cost: 0.01, description: "test" }),
  }).then(r => r.json());
  console.log("CONSUME:", c1.session?.consumedReadable);

  // Settle — should get 402
  const settleRes = await fetch(`http://localhost:3000/channel/settle/${channel.sessionId}`, {
    method: "POST",
  });
  console.log("\nSETTLE STATUS:", settleRes.status);
  
  // Print all headers
  console.log("\nRESPONSE HEADERS:");
  for (const [key, value] of settleRes.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  // Parse WWW-Authenticate
  const authHeader = settleRes.headers.get("www-authenticate");
  if (authHeader) {
    console.log("\n--- WWW-Authenticate Challenge ---");
    console.log(authHeader.substring(0, 200) + "...");
    
    // Extract request field
    const requestMatch = authHeader.match(/request="([^"]*)"/);
    if (requestMatch) {
      let base64 = requestMatch[1].replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const decoded = Buffer.from(base64, "base64").toString();
      console.log("\nDecoded request:", JSON.parse(decoded));
    }
  } else {
    console.log("NO WWW-Authenticate header!");
    const body = await settleRes.text();
    console.log("Body:", body.substring(0, 500));
  }
}
main().catch(console.error);
