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

// ─── Parse the MPP 402 challenge ────────────────────────────────────────────

interface MppChallenge {
  id: string;
  realm: string;
  method: string;
  intent: string;
  request: string; // base64url-encoded JSON
  expires?: string;
  digest?: string;
  opaque?: string;
  [key: string]: string | undefined;
}

interface PaymentRequest {
  amount: string;
  currency: string; // USDC mint address
  recipient: string;
  description?: string;
  methodDetails?: {
    decimals?: number;
    network?: string;
    feePayer?: boolean;
    tokenProgram?: string;
    recentBlockhash?: string;
  };
}

/**
 * Parse WWW-Authenticate header from a 402 response.
 * Format: Payment key="value", key="value", ...
 */
function parseWWWAuthenticate(header: string): MppChallenge {
  const rest = header.replace(/^Payment\s+/i, "");
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(rest)) !== null) {
    params[match[1]] = match[2];
  }
  return params as unknown as MppChallenge;
}

/** Decode base64url string */
function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return atob(base64);
}

/** Encode to base64url */
function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Build and sign the USDC transfer ───────────────────────────────────────

export interface SettlePaymentResult {
  success: boolean;
  txSignature?: string;
  settlement?: {
    sessionId: string;
    settled: boolean;
    totalConsumed: string;
    totalConsumedReadable: string;
    requestsServed: number;
    unusedCredit: string;
    unusedCreditReadable: string;
  };
  error?: string;
}

export type PaymentProgress =
  | { step: "challenge"; detail: string }
  | { step: "building"; detail: string }
  | { step: "signing"; detail: string }
  | { step: "submitting"; detail: string }
  | { step: "confirmed"; detail: string; txSignature: string }
  | { step: "error"; detail: string };

/**
 * Full settlement flow:
 * 1. Call settle → get 402 with MPP challenge
 * 2. Parse challenge → extract payment details
 * 3. Build USDC SPL transfer transaction
 * 4. Sign with Phantom (don't broadcast)
 * 5. Format MPP credential (pull mode)
 * 6. Retry settle with Authorization header
 * 7. Server broadcasts, verifies, returns 200
 */
export async function settleWithPayment(
  sessionId: string,
  walletPublicKey: string,
  signTransaction: <T>(tx: T) => Promise<T>,
  onProgress?: (p: PaymentProgress) => void,
): Promise<SettlePaymentResult> {
  const settleUrl = `/api/channel/settle/${sessionId}`;

  // Step 1: Call settle to get the 402 challenge
  onProgress?.({ step: "challenge", detail: "Requesting settlement challenge…" });
  const challengeRes = await fetch(settleUrl, { method: "POST" });

  if (challengeRes.status === 200) {
    // Already settled or no payment needed
    const data = await challengeRes.json();
    return { success: true, settlement: data };
  }

  if (challengeRes.status !== 402) {
    const data = await challengeRes.json().catch(() => ({}));
    return {
      success: false,
      error: (data as { message?: string }).message || `Unexpected status ${challengeRes.status}`,
    };
  }

  // Step 2: Parse the 402 challenge
  const authHeader = challengeRes.headers.get("WWW-Authenticate");
  if (!authHeader) {
    return { success: false, error: "No WWW-Authenticate header in 402 response" };
  }

  const challenge = parseWWWAuthenticate(authHeader);
  const requestJson = base64urlDecode(challenge.request);
  const paymentRequest: PaymentRequest = JSON.parse(requestJson);

  const amountBaseUnits = BigInt(paymentRequest.amount);
  const recipientAddr = paymentRequest.recipient;
  const mintAddr = paymentRequest.currency;
  const decimals = paymentRequest.methodDetails?.decimals ?? 6;

  const amountReadable = `$${(Number(amountBaseUnits) / 10 ** decimals).toFixed(2)}`;
  onProgress?.({
    step: "building",
    detail: `Building USDC transfer: ${amountReadable} to ${recipientAddr.slice(0, 8)}…`,
  });

  // Step 3: Build the USDC SPL transfer
  const connection = new Connection(MAINNET_RPC, "confirmed");
  const payer = new PublicKey(walletPublicKey);
  const mint = new PublicKey(mintAddr);
  const recipient = new PublicKey(recipientAddr);

  const payerATA = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const recipientATA = getAssociatedTokenAddressSync(mint, recipient, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  // Check if recipient ATA exists; if not, create it (payer pays)
  const recipientAtaInfo = await connection.getAccountInfo(recipientATA);
  if (!recipientAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(payer, recipientATA, recipient, mint),
    );
  }

  // SPL token transfer (checked)
  instructions.push(
    createTransferCheckedInstruction(
      payerATA,
      mint,
      recipientATA,
      payer,
      amountBaseUnits,
      decimals,
    ),
  );

  const tx = new Transaction().add(...instructions);

  // Use the blockhash from the MPP challenge if provided, otherwise fetch fresh
  const challengeBlockhash = paymentRequest.methodDetails?.recentBlockhash;
  if (challengeBlockhash) {
    tx.recentBlockhash = challengeBlockhash;
  } else {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
  }
  tx.feePayer = payer;

  // Step 4: Sign with Phantom (pull mode — don't broadcast)
  onProgress?.({ step: "signing", detail: "Waiting for wallet signature…" });
  const signedTx = await signTransaction(tx);

  // Serialize the signed transaction
  const txBytes = (signedTx as Transaction).serialize();
  const txBase64 = btoa(String.fromCharCode(...txBytes));

  // Step 5: Format MPP credential
  onProgress?.({ step: "submitting", detail: "Submitting payment to server…" });

  const credential = {
    challenge: {
      id: challenge.id,
      realm: challenge.realm,
      method: challenge.method,
      intent: challenge.intent,
      request: challenge.request,
      ...(challenge.expires ? { expires: challenge.expires } : {}),
      ...(challenge.digest ? { digest: challenge.digest } : {}),
      ...(challenge.opaque ? { opaque: challenge.opaque } : {}),
    },
    payload: {
      type: "transaction",
      transaction: txBase64,
    },
  };

  const credentialEncoded = base64urlEncode(JSON.stringify(credential));

  // Step 6: Retry settle with the credential
  const settleRes = await fetch(settleUrl, {
    method: "POST",
    headers: {
      Authorization: `Payment ${credentialEncoded}`,
    },
  });

  if (settleRes.status === 200) {
    const data = await settleRes.json();

    // Extract tx signature from the signed transaction
    const sig = (signedTx as Transaction).signature;
    const txSignature = sig ? btoa(String.fromCharCode(...sig)) : undefined;

    onProgress?.({
      step: "confirmed",
      detail: `Payment confirmed! ${amountReadable} USDC settled on-chain`,
      txSignature: txSignature || "",
    });

    return { success: true, txSignature, settlement: data };
  }

  // If still 402 or other error
  const errorData = await settleRes.json().catch(() => ({}));
  const errorMsg = (errorData as { message?: string; detail?: string }).detail
    || (errorData as { message?: string }).message
    || `Settlement failed with status ${settleRes.status}`;

  onProgress?.({ step: "error", detail: errorMsg });
  return { success: false, error: errorMsg };
}
