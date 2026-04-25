'use client'

import { ExternalLink, ArrowRight } from 'lucide-react'

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-card/30 mt-auto" role="contentinfo">
      {/* CTA band */}
      <div className="border-b border-border bg-primary/[0.04]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Ready to integrate Dynamic Payment Sessions?
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
              Join the waitlist and get early access to the Valiron SDK for your platform.
            </p>
          </div>
          <div className="flex flex-col xs:flex-row items-center gap-3">
            <a
              href="https://www.valiron.co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Join the Waitlist
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              href="https://www.valiron.co/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
            >
              View SDK
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <a
            href="https://www.valiron.co"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground/80 hover:text-foreground transition-colors"
          >
            Valiron
          </a>
          <span className="text-border/50" aria-hidden="true">·</span>
          <span>Dynamic Payment Sessions on Solana</span>
        </div>
        <ul className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[10px] sm:text-[11px] text-muted-foreground font-medium" aria-label="Technology stack">
          <li>USDC · Solana Devnet</li>
          <li className="text-border/50" aria-hidden="true">·</li>
          <li>Escrow-backed sessions</li>
          <li className="text-border/50" aria-hidden="true">·</li>
          <li>Trust-adaptive credit</li>
        </ul>
      </div>
    </footer>
  )
}
