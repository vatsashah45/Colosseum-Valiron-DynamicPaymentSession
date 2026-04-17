// ─── API Response Types ───

export interface PreflightResponse {
  agentId: string
  tier: string
  score: number
  riskLevel: string
  creditLine: string
  creditLineReadable: string
  maxRequests: number | null
  durationSeconds: number
  escrowAddress: string
}

export interface OpenChannelResponse {
  sessionId: string
  agentId: string
  tier: TierName
  score: number
  riskLevel: string
  creditLine: string
  creditLineReadable: string
  maxRequests: number | null
  expiresAt: string
  durationSeconds: number
  depositConfirmed: boolean
  depositSignature: string
  escrowAddress: string
}

export interface OpenChannelError {
  error: string
  message: string
  score?: number
  tier?: string
  riskLevel?: string
}

export interface ConsumeResponse {
  requestId: string
  cost: string
  costReadable: string
  description?: string
  session: {
    consumed: string
    consumedReadable: string
    remaining: string
    remainingReadable: string
    requestCount: number
    maxRequests: number | null
    secondsRemaining: number
  }
}

export interface ChannelStatus {
  sessionId: string
  agentId: string
  tier: TierName
  creditLine: string
  creditLineReadable: string
  consumed: string
  consumedReadable: string
  remaining: string
  remainingReadable: string
  requestCount: number
  maxRequests: number | null
  expiresAt: string
  secondsRemaining: number
  active: boolean
  settled: boolean
}

export interface SettleResponse {
  sessionId: string
  settled: boolean
  totalConsumed: string
  totalConsumedReadable: string
  requestsServed: number
  unusedCredit: string
  unusedCreditReadable: string
  refundAmount?: string
  refundReadable?: string
  refundSignature?: string
}

// ─── UI Types ───

export type TierName = 'AAA' | 'AA' | 'A' | 'BAA' | 'BA' | 'B'

export type ServerStatus = 'checking' | 'online' | 'offline'

export type ErrorCode =
  | 'agent_rejected'
  | 'insufficient_balance'
  | 'unsettled_debt'
  | 'wallet_required'
  | 'connection_failed'
  | 'unknown'

export type PaymentStep =
  | 'idle'
  | 'challenge'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'confirmed'
  | 'error'

export interface ActivityLogEntry {
  id: string
  timestamp: Date
  type: 'consume' | 'settle' | 'error' | 'info'
  message: string
  detail?: string
}

export interface TierPolicy {
  tier: TierName
  label: string
  scoreRange: string
  creditLine: string
  duration: string
  maxRequests: number
}

export const TIER_POLICIES: TierPolicy[] = [
  { tier: 'AAA', label: 'Prime', scoreRange: '900-1000', creditLine: '$100.00', duration: '60 min', maxRequests: 1000 },
  { tier: 'AA', label: 'High Grade', scoreRange: '800-899', creditLine: '$50.00', duration: '45 min', maxRequests: 500 },
  { tier: 'A', label: 'Upper Medium', scoreRange: '700-799', creditLine: '$25.00', duration: '30 min', maxRequests: 250 },
  { tier: 'BAA', label: 'Medium', scoreRange: '600-699', creditLine: '$10.00', duration: '20 min', maxRequests: 100 },
  { tier: 'BA', label: 'Speculative', scoreRange: '500-599', creditLine: '$5.00', duration: '10 min', maxRequests: 50 },
  { tier: 'B', label: 'Highly Speculative', scoreRange: '400-499', creditLine: '$2.00', duration: '5 min', maxRequests: 25 },
]
