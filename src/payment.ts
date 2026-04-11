import { randomBytes } from "node:crypto";
import { Mppx, solana } from "@solana/mpp/server";
import { CONFIG } from "./config.js";

export function createMppx() {
  if (!CONFIG.solana.recipient) {
    throw new Error("RECIPIENT_WALLET env var is required");
  }

  const secretKey = process.env.MPP_SECRET_KEY || randomBytes(32).toString("hex");

  return Mppx.create({
    secretKey,
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
