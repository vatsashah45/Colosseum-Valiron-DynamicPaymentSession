'use client'

import { ArrowDownRight, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ActivityLogEntry } from '@/lib/types'

interface ActivityLogProps {
  entries: ActivityLogEntry[]
}

const typeConfig = {
  consume: { icon: ArrowDownRight, color: 'text-chart-2' },
  settle: { icon: CheckCircle2, color: 'text-primary' },
  error: { icon: AlertCircle, color: 'text-destructive' },
  info: { icon: Info, color: 'text-muted-foreground' },
}

export function ActivityLog({ entries }: ActivityLogProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/10 p-6 sm:p-8 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">Ready for transactions. Your activity will appear here.</p>
      </div>
    )
  }

  return (
    <section 
      aria-labelledby="activity-log-heading"
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border bg-secondary/20">
        <h3 id="activity-log-heading" className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Activity Log</h3>
      </div>
      <ScrollArea className="max-h-48 sm:max-h-56">
        <ul className="flex flex-col divide-y divide-border/60" aria-label="Recent activity entries">
          {entries.map((entry) => {
            const config = typeConfig[entry.type]
            const Icon = config.icon
            return (
              <li key={entry.id} className="flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-secondary/10 transition-colors">
                <div className={cn('flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-secondary/60 shrink-0 mt-0.5')} aria-hidden="true">
                  <Icon className={cn('h-2.5 w-2.5 sm:h-3 sm:w-3', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-foreground">{entry.message}</p>
                  {entry.detail && (
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 font-mono truncate">{entry.detail}</p>
                  )}
                </div>
                <time 
                  dateTime={entry.timestamp.toISOString()}
                  className="hidden xs:block text-[9px] sm:text-[10px] text-muted-foreground shrink-0 tabular-nums font-mono mt-0.5"
                >
                  {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </time>
                <span className="sr-only">
                  at {entry.timestamp.toLocaleTimeString()}
                </span>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </section>
  )
}
