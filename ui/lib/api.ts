import type {
  PreflightResponse,
  OpenChannelResponse,
  OpenChannelError,
  ConsumeResponse,
  ChannelStatus,
  SettleResponse,
} from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...rest } = options ?? {}
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    const err = data as OpenChannelError
    const error = new Error(err.message || `Request failed (${res.status})`) as Error & {
      status: number
      code: string
      data: OpenChannelError
    }
    error.status = res.status
    error.code = err.error || 'unknown'
    error.data = err
    throw error
  }

  return data as T
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export async function preflightChannel(
  agentId: string,
  walletAddress: string
): Promise<PreflightResponse> {
  return request<PreflightResponse>(`/api/channel/preflight/${agentId}`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress }),
  })
}

export async function openChannel(
  agentId: string,
  walletAddress: string,
  depositSignature: string
): Promise<OpenChannelResponse> {
  return request<OpenChannelResponse>(`/api/channel/open/${agentId}`, {
    method: 'POST',
    body: JSON.stringify({ walletAddress, depositSignature }),
  })
}

export async function consumeService(
  sessionId: string,
  cost: number,
  description?: string
): Promise<ConsumeResponse> {
  return request<ConsumeResponse>(`/api/channel/consume/${sessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionId}`,
    },
    body: JSON.stringify({ cost, description }),
  })
}

export async function getChannelStatus(sessionId: string): Promise<ChannelStatus> {
  return request<ChannelStatus>(`/api/channel/status/${sessionId}`)
}

export async function settleChannel(sessionId: string): Promise<SettleResponse> {
  return request<SettleResponse>(`/api/channel/settle/${sessionId}`, {
    method: 'POST',
  })
}
