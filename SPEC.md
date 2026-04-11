# Dynamic Payment Sessions — Spec

**Repo**: `Colosseum-Valiron-DynamicPaymentSession`
**Chain**: Solana only (devnet → mainnet-beta)
**Stack**: Express + `@solana/mpp@0.5.0` + `@valiron/sdk@0.11.0`

---

## 1. The Idea

A **dynamic payment session framework** where transaction limits and session durations adapt based on agent trust. When an AI agent opens a payment session, Valiron scores the agent in real-time, and the framework dynamically sets:

- **Transaction limit** — the maximum USDC the agent can spend within the session
- **Session duration** — how long the payment window stays open

Higher-trust agents receive increased limits and longer payment session windows.
Lower-trust agents are more constrained. Untrusted agents are rejected entirely.

This is the first implementation of **trust-adaptive payment sessions** on Solana.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Agent (Client)                        │
│  @solana/mpp/client  +  @solana/kit (TransactionSigner)  │
└────────────────────────┬─────────────────────────────────┘
                         │
                    HTTP requests
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│            Dynamic Session Server (Express)               │
│                                                          │
│  POST /session/open/:agentId                             │
│    1. valiron.gate(agentId, { chain: 'solana' })         │
│    2. Map score → session params (txLimit, duration)     │
│    3. Return session token + terms to client             │
│                                                          │
│  POST /session/transact/:sessionId                       │
│    1. Validate session token + expiry                    │
│    2. Validate amount ≤ remaining transaction limit      │
│    3. mppx.charge({ amount }) → 402 payment flow        │
│    4. On payment success → deduct from limit             │
│    5. Return receipt + session state                     │
│                                                          │
│  GET /session/status/:sessionId                          │
│    Return remaining limit, time left, transactions made  │
│                                                          │
│  POST /session/close/:sessionId                          │
│    Force-close the session window                        │
│                                                          │
│  GET /health                                             │
│    Healthcheck                                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Trust-to-Session Mapping

Valiron gate returns: `{ allow, score (0-110), tier (AAA-C), riskLevel (GREEN/YELLOW/RED) }`

| Tier    | Score    | Risk   | Transaction Limit (USDC) | Session Duration | Max Tx/Session |
|---------|----------|--------|--------------------------|------------------|----------------|
| AAA     | 98-110   | GREEN  | $100.00                  | 60 min           | unlimited      |
| AA      | 88-97    | GREEN  | $50.00                   | 45 min           | 50             |
| A       | 78-87    | GREEN  | $25.00                   | 30 min           | 30             |
| BAA     | 68-77    | YELLOW | $10.00                   | 20 min           | 20             |
| BA      | 58-67    | YELLOW | $5.00                    | 15 min           | 10             |
| B       | 45-57    | RED    | $1.00                    | 10 min           | 5              |
| < B     | 0-44     | RED    | REJECTED                 | —                | —              |

**Key insight**: The session is a **payment window**, not a prepaid balance. Each transaction within the session goes through `@solana/mpp` `charge()` — real on-chain USDC transfers — but the framework enforces the trust-derived ceiling. A AAA agent can make up to $100 worth of transactions over 60 minutes. A B agent can only do $1 over 10 minutes.

> All values are configurable. The table above is the default policy.

---

## 4. API Contract

### 4.1 `POST /session/open/:agentId`

Opens a new payment session. No payment required to open — the session is a trust-derived authorization window for future transactions.

**Request**:
```
POST /session/open/25459
```

**403 Response** (untrusted agent):
```json
{
  "error": "agent_rejected",
  "score": 32,
  "tier": "C",
  "riskLevel": "RED",
  "message": "Agent does not meet minimum trust threshold."
}
```

**200 Response** (session opened):
```json
{
  "sessionId": "sess_abc123",
  "agentId": "25459",
  "tier": "AAA",
  "score": 102,
  "riskLevel": "GREEN",
  "transactionLimit": "100000000",
  "transactionLimitReadable": "$100.00",
  "remainingLimit": "100000000",
  "maxTransactions": null,
  "transactionsUsed": 0,
  "expiresAt": "2025-01-15T12:30:00Z",
  "durationSeconds": 3600
}
```

### 4.2 `POST /session/transact/:sessionId`

Execute a payment within the session. Each call triggers an `@solana/mpp` `charge()` flow — first call returns 402, client pays on Solana, retries with credential, server verifies and records.

**Request**:
```
POST /session/transact/sess_abc123
Authorization: Bearer sess_abc123
Content-Type: application/json

{
  "amount": "5000000",
  "description": "GPT-4o inference — 2k tokens"
}
```

**402 Response** (payment required — from `@solana/mpp`):
```
HTTP/1.1 402 Payment Required
WWW-Authenticate: PaymentRequired realm="dynamic-session",
  method="solana", intent="charge",
  amount="5000000", currency="EPjFWdd5...", ...
```

**200 Response** (payment verified, transaction recorded):
```json
{
  "receipt": {
    "transactionId": "tx_def456",
    "amount": "5000000",
    "amountReadable": "$5.00",
    "signature": "5Kz9...",
    "description": "GPT-4o inference — 2k tokens"
  },
  "session": {
    "remainingLimit": "95000000",
    "remainingLimitReadable": "$95.00",
    "transactionsUsed": 1,
    "expiresAt": "2025-01-15T12:30:00Z",
    "secondsRemaining": 3412
  }
}
```

**403 Response** (amount exceeds remaining limit):
```json
{
  "error": "limit_exceeded",
  "requested": "15000000",
  "remainingLimit": "10000000",
  "message": "Transaction amount exceeds remaining session limit."
}
```

**410 Response** (session expired):
```json
{
  "error": "session_expired",
  "message": "Payment session window has closed.",
  "durationSeconds": 3600,
  "transactionsCompleted": 7
}
```

**429 Response** (max transactions reached):
```json
{
  "error": "max_transactions",
  "message": "Maximum transactions per session reached.",
  "maxTransactions": 10,
  "transactionsUsed": 10
}
```

### 4.3 `GET /session/status/:sessionId`

Check session state without transacting.

```json
{
  "sessionId": "sess_abc123",
  "agentId": "25459",
  "tier": "AAA",
  "transactionLimit": "100000000",
  "remainingLimit": "95000000",
  "remainingLimitReadable": "$95.00",
  "transactionsUsed": 1,
  "maxTransactions": null,
  "expiresAt": "2025-01-15T12:30:00Z",
  "secondsRemaining": 3412,
  "active": true
}
```

### 4.4 `POST /session/close/:sessionId`

Close the payment window early.

```json
{
  "sessionId": "sess_abc123",
  "closed": true,
  "transactionsCompleted": 7,
  "totalSpent": "35000000",
  "totalSpentReadable": "$35.00",
  "unusedLimit": "65000000"
}
```

---

## 5. Implementation Modules

```
src/
  index.ts              # Express app, routes
  config.ts             # Env vars, tier policy table, constants
  session-manager.ts    # In-memory session store (Map)
  gate.ts               # Valiron gate integration + trust→policy mapping
  payment.ts            # @solana/mpp charge setup
  types.ts              # TypeScript interfaces
```

### 5.1 `config.ts`

```ts
export const TIER_POLICY = {
  AAA: { transactionLimit: 100_000_000, durationSeconds: 3600, maxTransactions: null },
  AA:  { transactionLimit:  50_000_000, durationSeconds: 2700, maxTransactions: 50   },
  A:   { transactionLimit:  25_000_000, durationSeconds: 1800, maxTransactions: 30   },
  BAA: { transactionLimit:  10_000_000, durationSeconds: 1200, maxTransactions: 20   },
  BA:  { transactionLimit:   5_000_000, durationSeconds:  900, maxTransactions: 10   },
  B:   { transactionLimit:   1_000_000, durationSeconds:  600, maxTransactions: 5    },
};

export const CONFIG = {
  port: Number(process.env.PORT) || 3000,
  solana: {
    network: (process.env.SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta',
    recipient: process.env.RECIPIENT_WALLET!, // operator's USDC wallet
    usdcMint: process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    rpcUrl: process.env.SOLANA_RPC_URL,
  },
  valiron: {
    baseUrl: process.env.VALIRON_URL || 'https://valiron-edge-proxy.onrender.com',
    minScore: Number(process.env.MIN_SCORE) || 45,
  },
};
```

### 5.2 `session-manager.ts`

```ts
interface Session {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  transactionLimit: number;   // max USDC in base units for entire session
  remainingLimit: number;     // how much is still available
  maxTransactions: number | null;
  transactionsUsed: number;
  totalSpent: number;
  createdAt: Date;
  expiresAt: Date;
  active: boolean;
  transactions: TransactionRecord[];
}

interface TransactionRecord {
  transactionId: string;
  amount: number;
  signature: string;
  description?: string;
  timestamp: Date;
}

class SessionManager {
  private sessions = new Map<string, Session>();

  create(agentId, tier, score, policy): Session { /* ... */ }
  get(sessionId): Session | undefined { /* ... */ }
  canTransact(sessionId, amount): { ok: boolean; reason?: string } { /* ... */ }
  recordTransaction(sessionId, amount, signature, description): Session { /* ... */ }
  close(sessionId): Session { /* ... */ }
  cleanup(): void { /* Remove expired sessions */ }
}
```

### 5.3 `gate.ts`

```ts
import { ValironSDK } from '@valiron/sdk';

const valiron = new ValironSDK({ chain: 'solana' });

export async function gateAgent(agentId: string) {
  const result = await valiron.gate(agentId);
  if (!result.allow || result.score < CONFIG.valiron.minScore) {
    return { allowed: false, result };
  }
  const policy = TIER_POLICY[result.tier];
  return { allowed: true, result, policy };
}
```

### 5.4 `payment.ts`

```ts
import { Mppx, solana } from '@solana/mpp/server';

export function createMppx() {
  return Mppx.create({
    methods: [
      solana.charge({
        recipient: CONFIG.solana.recipient,
        currency: CONFIG.solana.usdcMint,
        decimals: CONFIG.solana.decimals,
        network: CONFIG.solana.network,
        rpcUrl: CONFIG.solana.rpcUrl,
      }),
    ],
  });
}
```

---

## 6. Request Flow (Detailed)

### Opening a session (free — no payment):

```
Client                          Server                        Valiron
  |                               |                             |
  |  POST /session/open/25459     |                             |
  |------------------------------>|                             |
  |                               |  gate(25459, solana)        |
  |                               |---------------------------->|
  |                               |  { allow:true, score:102,   |
  |                               |    tier:'AAA' }             |
  |                               |<----------------------------|
  |                               |                             |
  |                               |  create session:            |
  |                               |    limit=$100, ttl=60min    |
  |  200 { sessionId, limit,      |                             |
  |        duration, tier }       |                             |
  |<------------------------------|                             |
```

### Transacting within the session (each tx is a real payment):

```
Client                          Server                        Solana
  |                               |                             |
  |  POST /session/transact/sess_abc123                         |
  |  { amount: "5000000" }        |                             |
  |------------------------------>|                             |
  |                               |  validate: session active?  |
  |                               |  validate: amount ≤ limit?  |
  |                               |  validate: tx count ok?     |
  |                               |                             |
  |                               |  mppx.charge(amount)        |
  |  402 + WWW-Authenticate       |                             |
  |<------------------------------|                             |
  |                                                             |
  |  [client signs USDC transfer]                               |
  |  POST /session/transact/sess_abc123                         |
  |  + payment credential                                       |
  |------------------------------>|                             |
  |                               |  verify on-chain            |
  |                               |---------------------------->|
  |                               |<----------------------------|
  |                               |                             |
  |                               |  record: remaining=$95      |
  |  200 { receipt, session }     |                             |
  |<------------------------------|                             |
```

---

## 7. Demo Client

A Node.js script that demonstrates agents with different trust levels getting different session terms.

```
demo/
  client.ts     # Headless mppx client, opens session, makes transactions
  simulate.ts   # Runs multiple agents, prints comparison table
```

```ts
// demo/client.ts (sketch)
import { Mppx, solana } from '@solana/mpp/client';
import { createKeyPairSignerFromBytes } from '@solana/kit';

const signer = await createKeyPairSignerFromBytes(keypairBytes);
const mppx = Mppx.create({
  methods: [solana.charge({ signer, rpcUrl: 'https://api.devnet.solana.com' })],
});

// 1. Open session (no payment needed)
const res = await fetch(`${SERVER}/session/open/${agentId}`, { method: 'POST' });
const session = await res.json();
console.log(`Session opened: limit=$${session.transactionLimitReadable}, duration=${session.durationSeconds}s`);

// 2. Make transactions within the session window
const txRes = await mppx.fetch(`${SERVER}/session/transact/${session.sessionId}`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.sessionId}` },
  body: JSON.stringify({ amount: '5000000', description: 'Inference call' }),
});
const receipt = await txRes.json();
console.log(`Tx done: spent=$${receipt.receipt.amountReadable}, remaining=$${receipt.session.remainingLimitReadable}`);
```

**Demo output** (3 agents, same server):
```
┌─────────┬───────┬───────┬──────────────────┬──────────┬────────┐
│ Agent   │ Score │ Tier  │ Transaction Limit│ Duration │ Max Tx │
├─────────┼───────┼───────┼──────────────────┼──────────┼────────┤
│ agent-1 │  102  │ AAA   │ $100.00          │ 60 min   │ ∞      │
│ agent-2 │   73  │ BAA   │ $10.00           │ 20 min   │ 20     │
│ agent-3 │   51  │ B     │ $1.00            │ 10 min   │ 5      │
│ agent-4 │   32  │ C     │ REJECTED         │ —        │ —      │
└─────────┴───────┴───────┴──────────────────┴──────────┴────────┘
```

---

## 8. Environment Variables

| Variable          | Required | Default                              | Description                              |
|-------------------|----------|--------------------------------------|------------------------------------------|
| `RECIPIENT_WALLET`| Yes      | —                                    | Operator's Solana wallet (receives USDC) |
| `SOLANA_NETWORK`  | No       | `devnet`                             | Solana cluster                           |
| `USDC_MINT`       | No       | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | USDC mint address           |
| `SOLANA_RPC_URL`  | No       | Public RPC                           | Custom RPC endpoint                      |
| `VALIRON_URL`     | No       | `https://valiron-edge-proxy.onrender.com` | Valiron edge-proxy URL              |
| `MIN_SCORE`       | No       | `45`                                 | Minimum score to open a session          |
| `PORT`            | No       | `3000`                               | Server port                              |

---

## 9. Package Dependencies

```json
{
  "dependencies": {
    "@solana/mpp": "^0.5.0",
    "@solana/kit": "^2.1.0",
    "@valiron/sdk": "^0.11.0",
    "express": "^5.1.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsx": "^4.0.0",
    "@types/express": "^5.0.0",
    "@types/uuid": "^10.0.0"
  }
}
```

---

## 10. What Makes This a Hackathon Winner

1. **Novel primitive**: First trust-adaptive payment session framework on Solana — dynamically adjusts transaction limits and session windows based on real-time agent reputation
2. **Real infrastructure**: `@solana/mpp` for 402-based USDC payments, `@valiron/sdk` for on-chain trust scoring — fully functional, not mocked
3. **Clear demo**: Side-by-side comparison of agents with different trust levels getting visibly different session terms
4. **Framework, not app**: Any service can plug this in as middleware to gate agent payments by trust
5. **Solana-native**: USDC micropayments, devnet-ready, fast confirmation

---

## 11. Build Order

1. `npm init`, install deps, tsconfig
2. `types.ts` + `config.ts` (tier policy table)
3. `payment.ts` — Mppx setup with solana.charge
4. `gate.ts` — Valiron SDK integration + tier→policy mapping
5. `session-manager.ts` — in-memory session CRUD with limit enforcement
6. `index.ts` — Express routes wiring it all together
7. `demo/client.ts` — headless client
8. `demo/simulate.ts` — multi-agent comparison table
9. Test on devnet
10. README with demo output
