'use client'

import type { ServerStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ServerStatusStripProps {
  status: ServerStatus
}

export function ServerStatusStrip({ status }: ServerStatusStripProps) {
  const statusLabel = status === 'checking' 
    ? 'Connecting to payment server' 
    : status === 'online' 
      ? 'Connected and ready to transact' 
      : 'Payment server temporarily unavailable'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
      className={cn(
        'flex items-center justify-center gap-2 py-1.5 text-[11px] font-semibold tracking-wide border-b transition-colors',
        status === 'online' && 'border-primary/15 bg-primary/[0.03] text-primary',
        status === 'offline' && 'border-destructive/15 bg-destructive/[0.03] text-destructive',
        status === 'checking' && 'border-border bg-secondary/30 text-muted-foreground'
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'online' && 'bg-primary animate-pulse',
          status === 'offline' && 'bg-destructive animate-pulse',
          status === 'checking' && 'bg-muted-foreground animate-pulse'
        )}
      />
      <span>
        {status === 'checking' && 'Connecting...'}
        {status === 'online' && 'Connected'}
        {status === 'offline' && 'Connection Lost'}
      </span>
    </div>
  )
}
