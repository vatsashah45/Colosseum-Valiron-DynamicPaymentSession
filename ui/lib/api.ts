const API = "/api";

export interface ChannelOpenResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  score: number;
  riskLevel: string;
  creditLine: string;
  creditLineReadable: string;
  maxRequests: number | null;
  expiresAt: string;
  durationSeconds: number;
  walletVerified: boolean;
  walletBalance: string;
}

export interface ConsumeResponse {
  requestId: string;
  cost: string;
  costReadable: string;
  description?: string;
  session: {
    consumed: string;
    consumedReadable: string;
    remaining: string;
    remainingReadable: string;
    requestCount: number;
    maxRequests: number | null;
    secondsRemaining: number;
  };
}

export interface ChannelStatusResponse {
  sessionId: string;
  agentId: string;
  tier: string;
  creditLine: string;
  creditLineReadable: string;
  consumed: string;
  consumedReadable: string;
  remaining: string;
  remainingReadable: string;
  requestCount: number;
  maxRequests: number | null;
  expiresAt: string;
  secondsRemaining: number;
  active: boolean;
  settled: boolean;
}

export interface SettlementResponse {
  sessionId: string;
  settled: boolean;
  totalConsumed: string;
  totalConsumedReadable: string;
  requestsServed: number;
  unusedCredit: string;
  unusedCreditReadable: string;
}

export interface ErrorResponse {
  error: string;
  score?: number;
  tier?: string;
  riskLevel?: string;
  message: string;
}

export async function openChannel(agentId: string, walletAddress?: string): Promise<{
  status: number;
  data: ChannelOpenResponse | ErrorResponse;
}> {
  const res = await fetch(`${API}/channel/open/${agentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

export async function consume(
  sessionId: string,
  cost: number,
  description?: string
): Promise<{ status: number; data: ConsumeResponse | Record<string, unknown> }> {
  const res = await fetch(`${API}/channel/consume/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionId}`,
    },
    body: JSON.stringify({ cost, description }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

export async function getChannelStatus(
  sessionId: string
): Promise<ChannelStatusResponse> {
  const res = await fetch(`${API}/channel/status/${sessionId}`);
  return res.json();
}

export async function settleChannel(
  sessionId: string
): Promise<{ status: number; data: SettlementResponse | Record<string, unknown> }> {
  const res = await fetch(`${API}/channel/settle/${sessionId}`, {
    method: "POST",
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
