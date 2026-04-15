import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

// ─── Escrow Deposit ─────────────────────────────────────────────────────────
// Build a USDC transfer from agent wallet to the escrow wallet,
// sign with Phantom, submit on-chain, return the tx signature.

export type DepositProgress =
  | { step: "building"; detail: string }
  | { step: "signing"; detail: string }
  | { step: "submitting"; detail: string }
  | { step: "confirmed"; detail: string; txSignature: string }
  | { step: "error"; detail: string };

export interface DepositResult {
  success: boolean;
  txSignature?: string;
  error?: string;
}

/**
 * Deposit USDC into the escrow wallet.
 * Called after preflight to lock the credit line before opening a channel.
 *
 * @param escrowAddress  The escrow wallet public key (from server)
 * @param amountBaseUnits  Credit line amount in USDC base units (6 decimals)
 * @param walletPublicKey  Agent's wallet public key
 * @param signTransaction  Phantom's signTransaction function
 * @param onProgress  Optional progress callback
 */
export async function depositToEscrow(
  escrowAddress: string,
  amountBaseUnits: string,
  walletPublicKey: string,
  signTransaction: <T>(tx: T) => Promise<T>,
  onProgress?: (p: DepositProgress) => void,
): Promise<DepositResult> {
  const amount = BigInt(amountBaseUnits);
  const amountReadable = `$${(Number(amount) / 10 ** USDC_DECIMALS).toFixed(2)}`;

  onProgress?.({
    step: "building",
    detail: `Building USDC deposit: ${amountReadable} to escrow ${escrowAddress.slice(0, 8)}…`,
  });

  try {
    const connection = new Connection(MAINNET_RPC, "confirmed");
    const payer = new PublicKey(walletPublicKey);
    const mint = new PublicKey(USDC_MINT);
    const escrow = new PublicKey(escrowAddress);

    const payerATA = getAssociatedTokenAddressSync(
      mint, payer, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const escrowATA = getAssociatedTokenAddressSync(
      mint, escrow, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const instructions: TransactionInstruction[] = [];

    // Create escrow ATA if it doesn't exist (payer pays rent)
    const escrowAtaInfo = await connection.getAccountInfo(escrowATA);
    if (!escrowAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(payer, escrowATA, escrow, mint),
      );
    }

    // USDC transfer: agent → escrow
    instructions.push(
      createTransferCheckedInstruction(
        payerATA, mint, escrowATA, payer,
        amount, USDC_DECIMALS,
      ),
    );

    const tx = new Transaction().add(...instructions);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // Sign with Phantom
    onProgress?.({ step: "signing", detail: "Waiting for wallet signature…" });
    const signedTx = await signTransaction(tx);

    // Submit on-chain
    onProgress?.({ step: "submitting", detail: "Submitting deposit to Solana…" });
    const rawTx = (signedTx as Transaction).serialize();
    const txSignature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation
    await connection.confirmTransaction(txSignature, "confirmed");

    onProgress?.({
      step: "confirmed",
      detail: `Deposit confirmed! ${amountReadable} USDC escrowed on-chain`,
      txSignature,
    });

    return { success: true, txSignature };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onProgress?.({ step: "error", detail: msg });
    return { success: false, error: msg };
  }
}
