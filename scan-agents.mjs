async function main() {
  const ids = [];
  for (let i = 1200; i <= 1260; i++) ids.push(String(i));
  
  for (const id of ids) {
    try {
      const r = await fetch(`https://valiron-edge-proxy.onrender.com/operator/gate/${id}?chain=solana`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).then(r => r.json());
      if (r.score > 0) {
        console.log(`${id}: score=${r.score} tier=${r.tier} allow=${r.allow}`);
      }
    } catch(e) {
      // skip
    }
  }
  console.log("Done scanning 1200-1260");
}
main();
