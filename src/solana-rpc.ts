import { CONFIG } from "./config.js";

const RPC_URL =
  CONFIG.solana.rpcUrl ||
  (CONFIG.solana.network === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

/**
 * Get the USDC token balance for a wallet address (in base units, 6 decimals).
 * Uses the Solana JSON-RPC `getTokenAccountsByOwner` method directly — no extra deps.
 */
export async function getUsdcBalance(walletAddress: string): Promise<bigint> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      walletAddress,
      { mint: CONFIG.solana.usdcMint },
      { encoding: "jsonParsed" },
    ],
  };

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Solana RPC error: ${res.status}`);
  }

  const json = await res.json() as {
    result?: {
      value: Array<{
        account: {
          data: {
            parsed: {
              info: {
                tokenAmount: { amount: string };
              };
            };
          };
        };
      }>;
    };
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(`Solana RPC: ${json.error.message}`);
  }

  const accounts = json.result?.value ?? [];
  if (accounts.length === 0) return 0n;

  // Sum balances across all USDC token accounts (usually just one)
  let total = 0n;
  for (const acct of accounts) {
    const amount = acct.account.data.parsed.info.tokenAmount.amount;
    total += BigInt(amount);
  }

  return total;
}
