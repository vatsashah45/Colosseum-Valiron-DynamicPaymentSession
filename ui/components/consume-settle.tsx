'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DollarSign, Loader2, Globe,
  Lock, CheckCircle2, Clock, CreditCard, Hash,
  Zap, Image, Database, MessageSquare, Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { consumeService, getChannelStatus, settleChannel } from '@/lib/api'
import { Gauge } from '@/components/gauge'
import { PaymentSteps } from '@/components/payment-steps'
import { ActivityLog } from '@/components/activity-log'
import type {
  OpenChannelResponse,
  ChannelStatus,
  SettleResponse,
  PaymentStep,
  ActivityLogEntry,
} from '@/lib/types'

/* ── Preset API services for demo ── */
const PRESET_APIS = [
  {
    name: 'LLM Completion',
    icon: MessageSquare,
    cost: 0.50,
    url: 'https://httpbin.org/post',
    method: 'POST' as const,
    body: JSON.stringify({ prompt: 'Explain quantum computing in one sentence', model: 'gpt-4' }),
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    name: 'Image Analysis',
    icon: Image,
    cost: 1.00,
    url: 'https://httpbin.org/post',
    method: 'POST' as const,
    body: JSON.stringify({ image_url: 'https://example.com/photo.jpg', task: 'describe' }),
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
  },
  {
    name: 'Data Query',
    icon: Database,
    cost: 0.10,
    url: 'https://httpbin.org/get?query=SELECT+*+FROM+agents+LIMIT+10',
    method: 'GET' as const,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
  {
    name: 'Fast Inference',
    icon: Zap,
    cost: 0.25,
    url: 'https://httpbin.org/post',
    method: 'POST' as const,
    body: JSON.stringify({ input: 'classify: positive sentiment', model: 'fast-v1' }),
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
]

interface ConsumeSettleProps {
  channel: OpenChannelResponse
}

export function ConsumeSettle({ channel }: ConsumeSettleProps) {
  const [status, setStatus] = useState<ChannelStatus | null>(null)
  const [cost, setCost] = useState('0.50')
  const [customUrl, setCustomUrl] = useState('')
  const [activeCall, setActiveCall] = useState<string | null>(null) // preset name or 'custom'
  const [settling, setSettling] = useState(false)
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle')
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [settlementResult, setSettlementResult] = useState<SettleResponse | null>(null)
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addLog = useCallback((type: ActivityLogEntry['type'], message: string, detail?: string) => {
    setActivityLog((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date(),
        type,
        message,
        detail,
      },
      ...prev,
    ])
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getChannelStatus(channel.sessionId)
      setStatus(data)
      // Stop polling when the channel is no longer active
      if (data.settled || !data.active) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
      return data
    } catch {
      return null
    }
  }, [channel.sessionId])

  // Poll status
  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchStatus])

  const handleConsume = async (endpointName: string, endpointCost: number, url?: string, method: string = 'GET', body?: string) => {
    if (endpointCost <= 0) {
      setBanner({ type: 'warning', message: 'Enter a valid cost greater than $0.00.' })
      return
    }

    setActiveCall(endpointName)
    setBanner(null)

    let apiResponsePreview: string | undefined

    // Call the actual API endpoint if a URL is provided
    if (url) {
      try {
        addLog('info', `Calling ${endpointName}...`, url)
        const fetchOpts: RequestInit = {
          method,
          headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
          body: method === 'POST' ? body : undefined,
        }
        const apiRes = await fetch(url, fetchOpts)
        const text = await apiRes.text()
        try {
          const json = JSON.parse(text)
          apiResponsePreview = JSON.stringify(json, null, 2).slice(0, 300)
        } catch {
          apiResponsePreview = text.slice(0, 300)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Request failed'
        apiResponsePreview = `Error: ${msg}`
      }
    }

    // Charge the session
    try {
      const res = await consumeService(channel.sessionId, endpointCost, endpointName)
      addLog(
        'consume',
        `${endpointName} — ${res.costReadable}`,
        apiResponsePreview
          ? `${res.session.remainingReadable} remaining · Response: ${apiResponsePreview.slice(0, 120)}`
          : `${res.session.remainingReadable} remaining`
      )
      setBanner({ type: 'success', message: `${endpointName}: Charged ${res.costReadable}. ${res.session.remainingReadable} credit remaining.` })
      await fetchStatus()
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string }
      const statusCode = apiErr.status || 0
      let bannerMsg = apiErr.message || 'Could not process request'
      let bannerType: 'error' | 'warning' = 'error'

      if (statusCode === 403) bannerMsg = 'Cost exceeds remaining credit.'
      else if (statusCode === 404) bannerMsg = 'Channel not found.'
      else if (statusCode === 409) bannerMsg = 'Channel is already settled.'
      else if (statusCode === 410) bannerMsg = 'Channel has expired. Please open a new one.'
      else if (statusCode === 429) { bannerMsg = 'Request limit reached. Settle this channel to continue.'; bannerType = 'warning' }
      else if (statusCode >= 500) bannerMsg = 'Server unavailable. Please try again in a moment.'

      addLog('error', bannerMsg)
      setBanner({ type: bannerType, message: bannerMsg })
    } finally {
      setActiveCall(null)
    }
  }

  const handlePresetCall = (preset: typeof PRESET_APIS[number]) => {
    handleConsume(preset.name, preset.cost, preset.url, preset.method, preset.body)
  }

  const handleCustomCall = () => {
    const costNum = parseFloat(cost)
    if (isNaN(costNum) || costNum <= 0) {
      setBanner({ type: 'warning', message: 'Enter a valid cost greater than $0.00.' })
      return
    }
    const raw = customUrl.trim()
    let label = 'Custom API Call'
    if (raw) {
      try { label = `Custom: ${new URL(raw).hostname}` } catch { label = `Custom: ${raw.slice(0, 40)}` }
    }
    handleConsume(label, costNum, raw || undefined)
  }

  const handleSettle = async () => {
    setSettling(true)
    setBanner(null)
    setPaymentStep('submitting')
    setPaymentError(null)
    setSettlementResult(null)

    try {
      const result = await settleChannel(channel.sessionId)
      setPaymentStep('confirmed')
      setSettlementResult(result)
      addLog('settle', `Finalized: ${result.totalConsumedReadable} paid`, `${result.requestsServed} requests processed`)
      setBanner({ type: 'success', message: 'Settlement complete. Unused credit returned.' })
      if (pollRef.current) clearInterval(pollRef.current)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      setPaymentStep('error')
      setPaymentError(apiErr.message || 'Could not complete settlement')
      addLog('error', 'Settlement failed', apiErr.message || 'Transaction could not be finalized')
      setBanner({ type: 'error', message: 'Settlement failed. Your credit is safe. Please try again.' })
    } finally {
      setSettling(false)
    }
  }

  // Derived gauge values
  const secondsRemaining = status?.secondsRemaining ?? channel.durationSeconds
  const requestCount = status?.requestCount ?? 0
  const consumed = parseFloat((status?.consumedReadable || '$0.00').replace('$', ''))
  const creditLine = parseFloat((status?.creditLineReadable || channel.creditLineReadable).replace('$', ''))
  const remaining = creditLine - consumed
  const maxRequests = status?.maxRequests ?? channel.maxRequests ?? Infinity
  const isActive = status?.active ?? true
  const isSettled = status?.settled || settlementResult !== null

  return (
    <Card className="border-border bg-card overflow-hidden animate-fade-up">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-chart-2/10 border border-chart-2/20">
              <Globe className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight">API Gateway</CardTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Call endpoints against your trust-based credit line
              </p>
            </div>
          </div>
          <Badge
            variant={isSettled ? 'secondary' : isActive ? 'default' : 'destructive'}
            className="text-[11px] rounded-full px-2.5 font-semibold"
          >
            {isSettled ? 'Settled' : isActive ? 'Active' : 'Expired'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:gap-6">
        {/* Gauges */}
        <div className="flex justify-around items-center py-3 sm:py-4 rounded-xl bg-secondary/20 border border-border">
          <Gauge
            label="Time"
            value={secondsRemaining}
            max={channel.durationSeconds}
            displayValue={`${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`}
            icon={<Clock className="h-3 w-3" />}
          />
          <Gauge
            label="Credit"
            value={remaining}
            max={creditLine}
            displayValue={`$${remaining.toFixed(2)}`}
            icon={<CreditCard className="h-3 w-3" />}
          />
          <Gauge
            label="Requests"
            value={maxRequests === Infinity ? requestCount : maxRequests - requestCount}
            max={maxRequests === Infinity ? Math.max(requestCount, 1) : maxRequests}
            displayValue={maxRequests === Infinity ? `${requestCount}` : `${maxRequests - requestCount}`}
            unit={maxRequests === Infinity ? 'used' : `/ ${maxRequests}`}
            icon={<Hash className="h-3 w-3" />}
          />
        </div>

        {/* Banner */}
        {banner && (
          <div
            role={banner.type === 'error' ? 'alert' : 'status'}
            aria-live={banner.type === 'error' ? 'assertive' : 'polite'}
            className={cn(
              'rounded-lg px-4 py-2.5 text-xs font-medium border animate-fade-up',
              banner.type === 'success' && 'bg-primary/5 border-primary/20 text-primary',
              banner.type === 'error' && 'bg-destructive/5 border-destructive/20 text-destructive',
              banner.type === 'warning' && 'bg-warning/5 border-warning/20 text-warning'
            )}
          >
            {banner.message}
          </div>
        )}

        {/* API Endpoint Cards */}
        {!isSettled && isActive && (
          <div className="flex flex-col gap-4">
            {/* Preset API Services */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5">API Services</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_APIS.map((api) => {
                  const Icon = api.icon
                  const isCalling = activeCall === api.name
                  return (
                    <button
                      key={api.name}
                      onClick={() => handlePresetCall(api)}
                      disabled={activeCall !== null}
                      className={cn(
                        'flex flex-col items-start gap-1.5 p-3 rounded-lg border transition-all text-left',
                        api.bg,
                        'hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {isCalling
                            ? <Loader2 className={cn('h-4 w-4 animate-spin', api.color)} />
                            : <Icon className={cn('h-4 w-4', api.color)} />
                          }
                          <span className="text-xs font-semibold text-foreground">{api.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                          ${api.cost.toFixed(2)}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono truncate w-full">
                        {api.method} {new URL(api.url).hostname}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Endpoint */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2.5">Custom Endpoint</p>
              <form
                onSubmit={(e) => { e.preventDefault(); handleCustomCall(); }}
                className="flex flex-col gap-2"
                aria-label="Call a custom API endpoint"
              >
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="endpoint-url" className="sr-only">API endpoint URL</label>
                  <Input
                    id="endpoint-url"
                    type="url"
                    placeholder="https://api.example.com/v1/chat"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="pl-9 font-mono text-sm bg-secondary/60 border-border h-10"
                    disabled={activeCall !== null}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="relative w-28">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <label htmlFor="custom-cost" className="sr-only">Cost per call in USD</label>
                    <Input
                      id="custom-cost"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="pl-9 font-mono text-sm bg-secondary/60 border-border h-10"
                      disabled={activeCall !== null}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={activeCall !== null}
                    className="flex-1 gap-2 bg-chart-2 text-foreground hover:bg-chart-2/80 font-semibold h-10"
                  >
                    {activeCall === 'custom'
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                    Call Endpoint
                  </Button>
                </div>
              </form>
            </div>

            {/* Settle Button */}
            <Button
              onClick={handleSettle}
              disabled={settling || activeCall !== null}
              variant="outline"
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10"
              aria-label={settling ? 'Finalizing on-chain...' : 'Settle and close channel on Solana'}
            >
              {settling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {settling ? 'Settling on Solana...' : 'Settle & Close Channel'}
            </Button>
          </div>
        )}

        {/* Payment Progress Steps */}
        <PaymentSteps currentStep={paymentStep} error={paymentError} />

        {/* Settlement Summary */}
        {settlementResult && (
          <div 
            role="status"
            aria-live="polite"
            aria-label={`Settlement complete. Total consumed: ${settlementResult.totalConsumedReadable}. Requests served: ${settlementResult.requestsServed}. Returned: ${settlementResult.unusedCreditReadable}`}
            className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 glow-primary animate-fade-up"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 mb-3 sm:mb-4">
              <div className="flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-primary/20 border border-primary/30" aria-hidden="true">
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-primary">Settled on Solana</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Paid</span>
                <span className="text-base sm:text-lg font-mono font-bold text-foreground">{settlementResult.totalConsumedReadable}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Requests</span>
                <span className="text-base sm:text-lg font-mono font-bold text-foreground">{settlementResult.requestsServed}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Refunded</span>
                <span className="text-base sm:text-lg font-mono font-bold text-primary">{settlementResult.refundReadable || settlementResult.unusedCreditReadable}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</span>
                <span className="text-base sm:text-lg font-bold text-primary">Finalized</span>
              </div>
            </div>
            {settlementResult.refundSignature && (
              <div className="mt-3 pt-2.5 border-t border-primary/10">
                <span className="text-[11px] text-muted-foreground">
                  Refund tx: <a
                    href={`https://explorer.solana.com/tx/${settlementResult.refundSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {settlementResult.refundSignature.slice(0, 16)}…
                  </a>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Activity Log */}
        <ActivityLog entries={activityLog} />
      </CardContent>
    </Card>
  )
}
