'use client'

import { Wallet, LogOut, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface AppHeaderProps {
  connected: boolean
  shortAddress: string | null
  connecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  hasPhantom: boolean
}

export function AppHeader({
  connected,
  shortAddress,
  connecting,
  onConnect,
  onDisconnect,
  hasPhantom,
}: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50" role="banner">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between" aria-label="Main navigation">
        {/* Brand */}
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="https://www.valiron.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group"
            aria-label="Valiron — visit our website"
          >
            {/* Logo mark */}
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-primary" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="hidden xs:block">
              <span className="text-sm font-bold text-foreground tracking-tight leading-none group-hover:text-primary transition-colors">Valiron</span>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5 font-medium">Dynamic Payment Sessions</p>
            </div>
            <span className="xs:hidden text-sm font-bold text-foreground tracking-tight">Valiron</span>
          </a>

          {/* Divider + product label — visible on sm+ */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border/50">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">on Solana</span>
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
            <span className="text-[10px] font-medium text-primary">Devnet</span>
          </div>
        </div>

        {/* Right side — nav links + wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="https://www.valiron.co"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            Docs
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>

          <div role="group" aria-label="Wallet connection">
            {connected ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 rounded-full bg-secondary/80 pl-2 pr-2.5 py-1 border border-border" role="status" aria-label={`Wallet connected: ${shortAddress}`}>
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                  <span className="text-[11px] font-mono font-medium text-foreground">{shortAddress}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onDisconnect}
                  className="text-muted-foreground hover:text-foreground rounded-full h-8 w-8"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={onConnect}
                disabled={connecting}
                className="gap-1.5 sm:gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-3 sm:px-4 text-xs font-semibold h-8 sm:h-9"
                aria-label={connecting ? 'Connecting to wallet' : hasPhantom ? 'Connect Phantom wallet' : 'Install Phantom wallet extension'}
              >
                {connecting ? (
                  <Spinner className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">
                  {connecting ? 'Connecting...' : hasPhantom ? 'Connect Phantom' : 'Install Phantom'}
                </span>
                <span className="sm:hidden" aria-hidden="true">
                  {connecting ? '...' : 'Connect'}
                </span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
