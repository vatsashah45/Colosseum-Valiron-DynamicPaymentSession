'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Play, DollarSign, FileText, Loader2,
  Lock, CheckCircle2, Clock, CreditCard, Hash,
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

interface ConsumeSettleProps {
  channel: OpenChannelResponse
}

export function ConsumeSettle({ channel }: ConsumeSettleProps) {
  const [status, setStatus] = useState<ChannelStatus | null>(null)
  const [cost, setCost] = useState('0.50')
  const [description, setDescription] = useState('')
  const [consuming, setConsuming] = useState(false)
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

  const handleConsume = async () => {
    const costNum = parseFloat(cost)
    if (isNaN(costNum) || costNum <= 0) return

    setConsuming(true)
    setBanner(null)

    try {
      const res = await consumeService(channel.sessionId, costNum, description || undefined)
      addLog('consume', `Spent ${res.costReadable}`, description || `${res.session.remainingReadable} remaining`)
      setBanner({ type: 'success', message: `Charged ${res.costReadable}. ${res.session.remainingReadable} credit remaining.` })
      setDescription('')
      await fetchStatus()
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string }
      const statusCode = apiErr.status || 0
      let bannerMsg = apiErr.message || 'Could not process request'
      let bannerType: 'error' | 'warning' = 'error'

      if (statusCode === 403) bannerMsg = 'Session expired. Please open a new channel.'
      else if (statusCode === 410) bannerMsg = 'This channel has already been settled.'
      else if (statusCode === 429) { bannerMsg = 'Request limit reached. Settle this channel to continue.'; bannerType = 'warning' }
      else if (statusCode >= 500) bannerMsg = 'Server unavailable. Please try again in a moment.'

      addLog('error', bannerMsg)
      setBanner({ type: bannerType, message: bannerMsg })
    } finally {
      setConsuming(false)
    }
  }

  const handleSettle = async () => {
    setSettling(true)
    setBanner(null)
    setPaymentStep('challenge')
    setPaymentError(null)
    setSettlementResult(null)

    try {
      // Step 1: Initial settle call (may return 402 challenge)
      const firstResult = await settleChannel(channel.sessionId)

      if ('status' in firstResult && firstResult.status === 402) {
        addLog('info', 'Verifying payment authorization...', firstResult.wwwAuthenticate)

        setPaymentStep('building')
        // Simulate building a payment transaction
        await new Promise((r) => setTimeout(r, 800))

        setPaymentStep('signing')
        // Simulate signing
        await new Promise((r) => setTimeout(r, 1000))

        setPaymentStep('submitting')
        // Submit with payment credential
        const credential = btoa(`${channel.sessionId}:${Date.now()}`)
        const secondResult = await settleChannel(channel.sessionId, credential)

        if ('settled' in secondResult && secondResult.settled) {
          setPaymentStep('confirmed')
          setSettlementResult(secondResult as SettleResponse)
          addLog('settle', `Finalized: ${(secondResult as SettleResponse).totalConsumedReadable} paid`, `${(secondResult as SettleResponse).requestsServed} requests processed`)
          setBanner({ type: 'success', message: 'Settlement complete. Funds transferred on Solana.' })
        }
      } else if ('settled' in firstResult) {
        // Direct settlement (no challenge)
        setPaymentStep('confirmed')
        setSettlementResult(firstResult as SettleResponse)
        addLog('settle', `Finalized: ${(firstResult as SettleResponse).totalConsumedReadable} paid`)
        setBanner({ type: 'success', message: 'Settlement complete. Unused credit returned.' })
      }

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
              <Play className="h-4 w-4 text-chart-2" />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight">Consume & Settle</CardTitle>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Spend credit instantly off-chain, then finalize on Solana when done
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

        {/* Consume Form */}
        {!isSettled && isActive && (
          <form 
            onSubmit={(e) => { e.preventDefault(); handleConsume(); }}
            className="flex flex-col gap-2.5 sm:gap-3"
            aria-label="Consume service credits"
          >
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative w-full sm:w-28">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="service-cost" className="sr-only">Service cost in USD</label>
                <Input
                  id="service-cost"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="pl-9 font-mono text-sm bg-secondary/60 border-border h-10"
                  disabled={consuming}
                />
              </div>
              <div className="relative flex-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="service-description" className="sr-only">Service description (optional)</label>
                <Input
                  id="service-description"
                  placeholder="Service description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="pl-9 text-sm bg-secondary/60 border-border h-10"
                  disabled={consuming}
                />
              </div>
            </div>
            <div className="flex flex-col xs:flex-row gap-2 xs:gap-2.5">
              <Button
                type="submit"
                disabled={consuming || !cost}
                className="flex-1 gap-2 bg-chart-2 text-foreground hover:bg-chart-2/80 font-semibold h-10"
                aria-label={consuming ? 'Processing charge...' : `Charge $${cost} to credit`}
              >
                {consuming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                {consuming ? 'Charging...' : 'Consume'}
              </Button>
              <Button
                type="button"
                onClick={handleSettle}
                disabled={settling}
                variant="outline"
                className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/10 font-semibold h-10"
                aria-label={settling ? 'Finalizing on-chain...' : 'Settle and close channel on Solana'}
              >
                {settling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
                {settling ? 'Settling...' : 'Settle'}
              </Button>
            </div>
          </form>
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
