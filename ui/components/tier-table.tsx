'use client'

import { Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { TIER_POLICIES, type TierName } from '@/lib/types'

interface TierTableProps {
  activeTier?: TierName | null
}

function getTierAccent(tier: TierName) {
  const map: Record<TierName, string> = {
    'AAA': 'text-primary',
    'AA': 'text-primary/80',
    'A': 'text-chart-2',
    'BAA': 'text-chart-3',
    'BA': 'text-chart-4',
    'B': 'text-destructive',
  }
  return map[tier] || ''
}

export function TierTable({ activeTier }: TierTableProps) {
  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-chart-3/10 border border-chart-3/20">
            <Shield className="h-4 w-4 text-chart-3" />
          </div>
          <div>
            <CardTitle className="text-base font-bold tracking-tight">Tier Policy Reference</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Trust tiers, credit limits, and session parameters
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="rounded-xl border border-border overflow-hidden -mx-0.5">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tier policy table, scroll horizontally to see all columns">
            <Table className="min-w-[500px]">
              <caption className="sr-only">Trust tier policies with credit limits and session parameters</caption>
              <TableHeader>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead scope="col" className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-muted-foreground h-8 sm:h-9 sticky left-0 bg-secondary/30 z-10">Tier</TableHead>
                  <TableHead scope="col" className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-muted-foreground h-8 sm:h-9">Grade</TableHead>
                  <TableHead scope="col" className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-muted-foreground h-8 sm:h-9">Score</TableHead>
                  <TableHead scope="col" className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-muted-foreground h-8 sm:h-9 text-right">Credit</TableHead>
                  <TableHead scope="col" className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-muted-foreground h-8 sm:h-9 text-right">Time</TableHead>
                  <TableHead scope="col" className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-muted-foreground h-8 sm:h-9 text-right">Max Req</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TIER_POLICIES.map((policy) => {
                  const isActive = activeTier === policy.tier
                  return (
                    <TableRow
                      key={policy.tier}
                      className={cn(
                        'transition-all',
                        isActive
                          ? 'bg-primary/8 border-l-2 border-l-primary'
                          : 'hover:bg-secondary/20'
                      )}
                      aria-selected={isActive}
                    >
                      <TableHead scope="row" className="py-2 sm:py-2.5 sticky left-0 bg-card z-10 font-normal">
                        <span className={cn('text-xs sm:text-sm font-mono font-bold', getTierAccent(policy.tier))}>
                          {policy.tier}
                          {isActive && <span className="sr-only"> (current tier)</span>}
                        </span>
                      </TableHead>
                      <TableCell className="py-2 sm:py-2.5">
                        <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{policy.label}</span>
                      </TableCell>
                      <TableCell className="py-2 sm:py-2.5">
                        <span className="text-[11px] sm:text-xs font-mono text-foreground tabular-nums">{policy.scoreRange}</span>
                      </TableCell>
                      <TableCell className="py-2 sm:py-2.5 text-right">
                        <span className="text-[11px] sm:text-xs font-mono font-semibold text-foreground">{policy.creditLine}</span>
                      </TableCell>
                      <TableCell className="py-2 sm:py-2.5 text-right">
                        <span className="text-[11px] sm:text-xs font-mono text-foreground">{policy.duration}</span>
                      </TableCell>
                      <TableCell className="py-2 sm:py-2.5 text-right">
                        <span className="text-[11px] sm:text-xs font-mono text-foreground tabular-nums">{policy.maxRequests === null ? '∞' : policy.maxRequests.toLocaleString()}</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
