import { Mppx, solana } from "@solana/mpp/server";
import { CONFIG } from "./config.js";

export function createMppx() {
  if (!CONFIG.solana.recipient) {
    throw new Error("RECIPIENT_WALLET env var is required");
  }

  return Mppx.create({
    methods: [
      solana.charge({
        recipient: CONFIG.solana.recipient,
        currency: CONFIG.solana.usdcMint,
        decimals: CONFIG.solana.decimals,
        network: CONFIG.solana.network,
        ...(CONFIG.solana.rpcUrl ? { rpcUrl: CONFIG.solana.rpcUrl } : {}),
      }),
    ],
  });
}
