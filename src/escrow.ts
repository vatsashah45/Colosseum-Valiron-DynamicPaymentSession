import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { CONFIG } from "./config.js";

// ─── Escrow: server-controlled USDC wallet ─────────────────────────────────
// Agent deposits credit line at channel open.
// At settlement, server refunds unused portion from escrow.

const USDC_MINT = new PublicKey(CONFIG.solana.usdcMint);
const USDC_DECIMALS = CONFIG.solana.decimals;

let _keypair: Keypair | null = null;

function getKeypair(): Keypair | null {
  if (_keypair) return _keypair;
  const raw = process.env.ESCROW_PRIVATE_KEY;
  if (!raw) return null;
  try {
    // Accepts JSON array format: [1,2,3,...,64] (standard solana-keygen output)
    const bytes = JSON.parse(raw) as number[];
    _keypair = Keypair.fromSecretKey(Uint8Array.from(bytes));
    return _keypair;
  } catch {
    console.error("Failed to parse ESCROW_PRIVATE_KEY (expected JSON array of 64 bytes)");
    return null;
  }
}

function getConnection(): Connection {
  const rpcUrl =
    CONFIG.solana.rpcUrl ||
    (CONFIG.solana.network === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com");
  return new Connection(rpcUrl, "confirmed");
}

/** Returns the escrow wallet's public key (base58), or null if not configured. */
export function getEscrowAddress(): string | null {
  const kp = getKeypair();
  return kp ? kp.publicKey.toBase58() : null;
}

/**
 * Verify that a USDC deposit was made to the escrow wallet.
 * Checks the on-chain transaction for correct amount, sender, and recipient.
 */
export async function verifyDeposit(
  txSignature: string,
  expectedAmount: number,
  fromWallet: string,
): Promise<{ verified: boolean; actualAmount?: number; error?: string }> {
  const connection = getConnection();
  const escrowAddress = getEscrowAddress();

  if (!escrowAddress) {
    return { verified: false, error: "Escrow wallet not configured" };
  }

  try {
    const tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { verified: false, error: "Transaction not found on-chain. It may still be confirming." };
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed on-chain" };
    }

    // Check pre/post token balances to verify USDC transfer to escrow
    const preBalances = tx.meta?.preTokenBalances ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    const escrowPre = preBalances.find(
      (b) => b.owner === escrowAddress && b.mint === CONFIG.solana.usdcMint,
    );
    const escrowPost = postBalances.find(
      (b) => b.owner === escrowAddress && b.mint === CONFIG.solana.usdcMint,
    );

    const preAmount = Number(escrowPre?.uiTokenAmount?.amount ?? "0");
    const postAmount = Number(escrowPost?.uiTokenAmount?.amount ?? "0");
    const deposited = postAmount - preAmount;

    if (deposited < expectedAmount) {
      return {
        verified: false,
        actualAmount: deposited,
        error: `Deposit too small: expected ${expectedAmount}, got ${deposited}`,
      };
    }

    // Verify sender wallet was involved
    const senderInvolved =
      preBalances.some((b) => b.owner === fromWallet) ||
      postBalances.some((b) => b.owner === fromWallet);

    if (!senderInvolved) {
      return { verified: false, error: "Sender wallet not found in transaction" };
    }

    return { verified: true, actualAmount: deposited };
  } catch (err) {
    return {
      verified: false,
      error: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Send a USDC refund from the escrow wallet to the agent's wallet.
 * Called at settlement time to return unused credit.
 */
export async function sendRefund(
  toWallet: string,
  refundAmount: number,
): Promise<{ signature: string } | { error: string }> {
  const keypair = getKeypair();
  if (!keypair) return { error: "Escrow wallet not configured" };

  if (refundAmount <= 0) return { error: "No refund needed" };

  const connection = getConnection();
  const recipient = new PublicKey(toWallet);

  const escrowATA = getAssociatedTokenAddressSync(
    USDC_MINT, keypair.publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const recipientATA = getAssociatedTokenAddressSync(
    USDC_MINT, recipient, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();

  // Create recipient ATA if needed
  const recipientAtaInfo = await connection.getAccountInfo(recipientATA);
  if (!recipientAtaInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        keypair.publicKey, recipientATA, recipient, USDC_MINT,
      ),
    );
  }

  tx.add(
    createTransferCheckedInstruction(
      escrowATA, USDC_MINT, recipientATA, keypair.publicKey,
      BigInt(refundAmount), USDC_DECIMALS,
    ),
  );

  try {
    const signature = await sendAndConfirmTransaction(
      connection, tx, [keypair], { commitment: "confirmed" },
    );
    return { signature };
  } catch (err) {
    return {
      error: `Refund failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
