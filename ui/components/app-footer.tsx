'use client'

import { Zap } from 'lucide-react'

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card/20 mt-auto" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-primary/10" aria-hidden="true">
            <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-foreground/80">Dynamic Payment Channels</span>
          <span className="hidden xs:inline text-border/50 mx-1" aria-hidden="true">|</span>
          <span className="hidden xs:inline text-xs">Built on Solana</span>
        </div>
        <ul className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 sm:gap-4 text-[10px] sm:text-[11px] text-muted-foreground font-medium" aria-label="Platform features">
          <li className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-1 w-1 rounded-full bg-primary/40" aria-hidden="true" />
            USDC
          </li>
          <li className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-1 w-1 rounded-full bg-primary/40" aria-hidden="true" />
            Trust-Adaptive
          </li>
          <li className="flex items-center gap-1 sm:gap-1.5">
            <div className="h-1 w-1 rounded-full bg-primary/40" aria-hidden="true" />
            Off-Chain
          </li>
        </ul>
      </div>
    </footer>
  )
}
