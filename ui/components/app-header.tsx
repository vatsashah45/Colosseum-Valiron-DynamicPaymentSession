'use client'

import { Zap, Wallet, LogOut } from 'lucide-react'
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
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 border border-primary/20 glow-primary shrink-0" aria-hidden="true">
            <Zap className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-primary" />
          </div>
          <div className="hidden xs:block">
            <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
              Dynamic Payment Channels
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-1">
              Solana Micropayments
            </p>
          </div>
          <h1 className="xs:hidden text-xs font-bold text-foreground tracking-tight">
            <span className="sr-only">Dynamic Payment Channels - </span>DPC
          </h1>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Wallet connection">
          {connected ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-secondary/80 pl-2 pr-2.5 sm:pl-2.5 sm:pr-3 py-1 sm:py-1.5 border border-border" role="status" aria-label={`Wallet connected: ${shortAddress}`}>
                <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span className="text-[11px] sm:text-xs font-mono font-medium text-foreground">{shortAddress}</span>
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
      </nav>
    </header>
  )
}
