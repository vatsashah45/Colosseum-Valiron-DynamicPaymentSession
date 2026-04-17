'use client'

import { useState } from 'react'
import {
  Shield, AlertTriangle, Ban, Wallet, WifiOff,
  Clock, Hash, CreditCard, TrendingUp, ChevronRight,
  Check, Loader2, ArrowDownToLine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { preflightChannel, openChannel } from '@/lib/api'
import { depositToEscrow, type DepositProgress } from '@/lib/solana-payment'
import type { OpenChannelResponse, PreflightResponse, ErrorCode, TierName } from '@/lib/types'

// Real Valiron agent IDs from the Solana edge proxy.
// Valiron uses sequential numeric IDs (see demo/simulate.ts).
const SAMPLE_AGENTS = [
  { id: '999', label: 'Alpha' },   // score ~85, tier A (passes gate)
  { id: '1', label: 'Beta' },      // score ~65, tier BA
  { id: '42', label: 'Gamma' },    // score ~65, tier BA
  { id: '99999', label: 'Risky' }, // not registered → rejected
]

const ERROR_DETAILS: Record<string, { icon: typeof Shield; title: string; description: string; action: string }> = {
  agent_rejected: {
    icon: Ban,
    title: 'Agent Not Eligible',
    description: 'This agent has not built enough trust history to qualify for any credit tier.',
    action: 'Try a different agent or build trust history first.',
  },
  insufficient_balance: {
    icon: Wallet,
    title: 'Wallet Balance Too Low',
    description: 'Your wallet does not have enough funds to secure this credit line.',
    action: 'Add funds to your wallet and try again.',
  },
  unsettled_debt: {
    icon: AlertTriangle,
    title: 'Open Channel Exists',
    description: 'You have an existing channel that must be settled first.',
    action: 'Settle your current channel before opening a new one.',
  },
  wallet_required: {
    icon: Wallet,
    title: 'Wallet Not Connected',
    description: 'A connected wallet is required to open a payment channel.',
    action: 'Click "Connect Phantom" in the header to continue.',
  },
  connection_failed: {
    icon: WifiOff,
    title: 'Connection Lost',
    description: 'Could not reach the payment channel server.',
    action: 'Check your internet connection and try again.',
  },
  deposit_invalid: {
    icon: AlertTriangle,
    title: 'Deposit Not Verified',
    description: 'The escrow deposit could not be verified on-chain.',
    action: 'Ensure the transaction was confirmed and try again.',
  },
  deposit_already_used: {
    icon: AlertTriangle,
    title: 'Deposit Already Used',
    description: 'This deposit signature has already been used to open a channel.',
    action: 'Make a new deposit to open another channel.',
  },
  escrow_not_configured: {
    icon: AlertTriangle,
    title: 'Escrow Not Configured',
    description: 'The server has no escrow wallet set up, so it can\'t accept deposits yet.',
    action: 'Set ESCROW_PRIVATE_KEY in the backend .env and restart the server.',
  },
  balance_check_failed: {
    icon: WifiOff,
    title: 'Could Not Check Wallet Balance',
    description: 'The server failed to read your USDC balance from the Solana RPC.',
    action: 'Try again in a moment, or check the backend SOLANA_RPC_URL.',
  },
  gate_unavailable: {
    icon: WifiOff,
    title: 'Trust Service Unavailable',
    description: 'The Valiron trust gate could not be reached.',
    action: 'Try again in a moment.',
  },
  deposit_required: {
    icon: AlertTriangle,
    title: 'Deposit Required',
    description: 'A deposit signature is required to open the channel.',
    action: 'Run the preflight step first, then deposit USDC to escrow.',
  },
  unknown: {
    icon: AlertTriangle,
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred while processing your request.',
    action: 'Please try again. If the issue persists, refresh the page.',
  },
}

type FlowStep = 'idle' | 'preflight' | 'depositing' | 'opening' | 'done'

function getTierColor(tier: TierName) {
  const colors: Record<TierName, string> = {
    'AAA': 'text-primary border-primary/30 bg-primary/10',
    'AA': 'text-primary/80 border-primary/20 bg-primary/5',
    'A': 'text-chart-2 border-chart-2/30 bg-chart-2/10',
    'BAA': 'text-chart-3 border-chart-3/30 bg-chart-3/10',
    'BA': 'text-chart-4 border-chart-4/30 bg-chart-4/10',
    'B': 'text-destructive border-destructive/30 bg-destructive/10',
  }
  return colors[tier] || ''
}

function getRiskColor(risk: string) {
  const lower = risk.toLowerCase()
  if (lower === 'low') return 'text-primary'
  if (lower === 'medium') return 'text-chart-3'
  if (lower === 'high') return 'text-chart-4'
  return 'text-destructive'
}

interface GateAgentProps {
  walletAddress: string | null
  signTransaction: <T>(transaction: T) => Promise<T>
  onChannelOpened: (data: OpenChannelResponse) => void
}

export function GateAgent({ walletAddress, signTransaction, onChannelOpened }: GateAgentProps) {
  const [agentId, setAgentId] = useState('')
  const [flowStep, setFlowStep] = useState<FlowStep>('idle')
  const [depositProgress, setDepositProgress] = useState<DepositProgress | null>(null)
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null)
  const [error, setError] = useState<{ code: ErrorCode; message: string; score?: number; tier?: string; riskLevel?: string } | null>(null)
  const [result, setResult] = useState<OpenChannelResponse | null>(null)

  const loading = flowStep !== 'idle' && flowStep !== 'done'

  const handleSubmit = async (id?: string) => {
    const targetId = id || agentId
    if (!targetId.trim()) return

    if (!walletAddress) {
      setError({ code: 'wallet_required', message: 'Connect your wallet first' })
      return
    }

    setError(null)
    setResult(null)
    setPreflight(null)
    setDepositProgress(null)

    try {
      // Step 1: Preflight — gate check + escrow address
      setFlowStep('preflight')
      const preflightData = await preflightChannel(targetId.trim(), walletAddress)
      setPreflight(preflightData)

      // Step 2: Deposit USDC to escrow
      setFlowStep('depositing')
      const depositResult = await depositToEscrow(
        preflightData.escrowAddress,
        preflightData.creditLine,
        walletAddress,
        signTransaction,
        (p) => setDepositProgress(p),
      )

      if (!depositResult.success || !depositResult.txSignature) {
        setError({
          code: 'unknown',
          message: depositResult.error || 'Escrow deposit failed',
        })
        setFlowStep('idle')
        return
      }

      // Step 3: Open channel with deposit signature
      setFlowStep('opening')
      const data = await openChannel(targetId.trim(), walletAddress, depositResult.txSignature)
      setResult(data)
      setFlowStep('done')
      onChannelOpened(data)
    } catch (err: unknown) {
      const apiError = err as { code?: string; message?: string; data?: { score?: number; tier?: string; riskLevel?: string } }
      setError({
        code: (apiError.code as ErrorCode) || 'unknown',
        message: apiError.message || 'An unexpected error occurred',
        score: apiError.data?.score,
        tier: apiError.data?.tier,
        riskLevel: apiError.data?.riskLevel,
      })
      setFlowStep('idle')
    }
  }

  const ErrorDetail = error ? ERROR_DETAILS[error.code] || ERROR_DETAILS.unknown : null
  const ErrorIcon = ErrorDetail?.icon || AlertTriangle

  const stepLabel = flowStep === 'preflight'
    ? 'Checking trust...'
    : flowStep === 'depositing'
    ? 'Depositing to escrow...'
    : flowStep === 'opening'
    ? 'Opening channel...'
    : 'Gate Agent'

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-bold tracking-tight">Gate Agent & Open Channel</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Enter an agent ID to check trust, deposit USDC on Devnet to escrow, and open a credit line. Please note, you will also need a small amount of SOL (Devnet) to pay for the transaction fee.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:gap-5">
        {/* Input */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="flex flex-col sm:flex-row gap-2.5"
          role="search"
          aria-label="Gate an AI agent"
        >
          <label htmlFor="agent-id-input" className="sr-only">Agent ID</label>
          <Input
            id="agent-id-input"
            placeholder="Enter agent ID (e.g. 999)"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="font-mono text-sm bg-secondary/60 border-border h-10"
            aria-describedby="agent-id-hint"
            disabled={loading}
            autoComplete="off"
          />
          <span id="agent-id-hint" className="sr-only">Enter an agent identifier to evaluate their trust score</span>
          <Button
            type="submit"
            disabled={loading || !agentId.trim()}
            className="gap-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 px-5 font-semibold w-full sm:w-auto"
            aria-label={loading ? stepLabel : 'Check trust score and open channel'}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
            {stepLabel}
          </Button>
        </form>

        {/* Sample Agents */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label="Sample agents to try">
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium" id="sample-agents-label">Try:</span>
          {SAMPLE_AGENTS.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                setAgentId(agent.id)
                handleSubmit(agent.id)
              }}
              disabled={loading}
              className="rounded-full border border-border bg-secondary/40 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-xs font-mono text-muted-foreground transition-all cursor-pointer hover:border-primary/40 hover:text-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Try agent ${agent.label}`}
            >
              {agent.label}
            </button>
          ))}
        </div>

        {/* Deposit Progress */}
        {flowStep === 'depositing' && depositProgress && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-chart-3/20 bg-chart-3/5 p-4 animate-fade-up"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-chart-3/20 border border-chart-3/30" aria-hidden="true">
                <ArrowDownToLine className="h-3.5 w-3.5 text-chart-3" />
              </div>
              <span className="text-xs font-bold text-chart-3 capitalize">{depositProgress.step}</span>
              {preflight && (
                <Badge className={cn('ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold', getTierColor(preflight.tier as TierName))}>
                  {preflight.tier}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{depositProgress.detail}</p>
            {preflight && (
              <div className="flex gap-3 mt-2 pt-2 border-t border-chart-3/10 text-[11px] text-muted-foreground">
                <span>Deposit: <span className="font-mono font-semibold text-foreground">{preflight.creditLineReadable}</span></span>
                <span>Escrow: <span className="font-mono text-foreground">{preflight.escrowAddress.slice(0, 8)}…</span></span>
              </div>
            )}
          </div>
        )}

        {/* Error Panel */}
        {error && (
          <div 
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 animate-fade-up"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 shrink-0" aria-hidden="true">
                <ErrorIcon className="h-4.5 w-4.5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">{ErrorDetail?.title}</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{ErrorDetail?.description}</p>
                <p className="text-xs text-primary/80 mt-2 leading-relaxed font-medium">{ErrorDetail?.action}</p>
                {(error.score !== undefined || error.tier || error.riskLevel) && (
                  <div className="flex gap-3 mt-3 pt-2.5 border-t border-destructive/10">
                    {error.score !== undefined && (
                      <span className="text-[11px] text-muted-foreground">
                        Score: <span className="text-foreground font-mono">{error.score}</span>
                      </span>
                    )}
                    {error.tier && (
                      <span className="text-[11px] text-muted-foreground">
                        Tier: <span className="text-foreground font-mono">{error.tier}</span>
                      </span>
                    )}
                    {error.riskLevel && (
                      <span className="text-[11px] text-muted-foreground">
                        Risk: <span className={cn('font-mono', getRiskColor(error.riskLevel))}>{error.riskLevel}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Panel */}
        {result && (
          <div 
            role="status"
            aria-live="polite"
            aria-label={`Channel opened successfully. Tier: ${result.tier}, Score: ${result.score}, Credit line: ${result.creditLineReadable}`}
            className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 glow-primary animate-fade-up"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 mb-3 sm:mb-4">
              <div className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-primary/20 border border-primary/30" aria-hidden="true">
                <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-primary">Channel Ready — Deposit Confirmed</span>
              <Badge className={cn('ml-auto text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full font-bold', getTierColor(result.tier))}>
                {result.tier}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 sm:gap-1.5 font-semibold">
                  <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Score
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-foreground">{result.score}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 sm:gap-1.5 font-semibold">
                  <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Risk
                </span>
                <span className={cn('text-base sm:text-lg font-mono font-bold', getRiskColor(result.riskLevel))}>
                  {result.riskLevel}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 sm:gap-1.5 font-semibold">
                  <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Escrowed
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-foreground">{result.creditLineReadable}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 sm:gap-1.5 font-semibold">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Duration
                </span>
                <span className="text-base sm:text-lg font-mono font-bold text-foreground">{result.durationSeconds}s</span>
              </div>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 xs:gap-4 mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-primary/10">
              <span className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                <Hash className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> Max Requests:
                <span className="font-mono font-semibold text-foreground">{result.maxRequests ?? '∞'}</span>
              </span>
              <span className="text-[11px] sm:text-xs text-muted-foreground">
                Session: <span className="font-mono font-semibold text-foreground">{result.sessionId.slice(0, 8)}...</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
