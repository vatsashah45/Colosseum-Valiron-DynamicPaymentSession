const API = "/api";

export interface SessionOpenResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  transactionLimit: string;
  transactionLimitReadable: string;
  remainingLimit: string;
  maxTransactions: number | null;
  transactionsUsed: number;
  expiresAt: string;
  durationSeconds: number;
}

export interface SessionStatusResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  transactionLimit: string;
  remainingLimit: string;
  remainingLimitReadable: string;
  transactionsUsed: number;
  maxTransactions: number | null;
  expiresAt: string;
  secondsRemaining: number;
  active: boolean;
}

export interface SessionCloseResponse {
  sessionId: string;
  closed: boolean;
  transactionsCompleted: number;
  totalSpent: string;
  totalSpentReadable: string;
  unusedLimit: string;
}

export interface ErrorResponse {
  error: string;
  score?: number;
  tier?: string;
  riskLevel?: string;
  message: string;
}

export async function openSession(agentId: string): Promise<{
  status: number;
  data: SessionOpenResponse | ErrorResponse;
}> {
  const res = await fetch(`${API}/session/open/${agentId}`, { method: "POST" });
  const data = await res.json();
  return { status: res.status, data };
}

export async function getSessionStatus(
  sessionId: string
): Promise<SessionStatusResponse> {
  const res = await fetch(`${API}/session/status/${sessionId}`);
  return res.json();
}

export async function closeSession(
  sessionId: string
): Promise<SessionCloseResponse> {
  const res = await fetch(`${API}/session/close/${sessionId}`, {
    method: "POST",
  });
  return res.json();
}

export async function transact(
  sessionId: string,
  amount: number,
  description?: string
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${API}/session/transact/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionId}`,
    },
    body: JSON.stringify({ amount, description }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
