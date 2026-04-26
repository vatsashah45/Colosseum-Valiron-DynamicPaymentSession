'use client'

import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/app-header'
import { ServerStatusStrip } from '@/components/server-status'
import { GateAgent } from '@/components/gate-agent'
import { ConsumeSettle } from '@/components/consume-settle'
import { TierTable } from '@/components/tier-table'
import { HowItWorks } from '@/components/how-it-works'
import { ValueProps } from '@/components/value-props'
import { AppFooter } from '@/components/app-footer'
import { useWallet } from '@/hooks/use-wallet'
import { checkHealth } from '@/lib/api'
import type { OpenChannelResponse, ServerStatus } from '@/lib/types'
import { ArrowDown, ExternalLink, Wallet } from 'lucide-react'

export default function Home() {
  const wallet = useWallet()
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking')
  const [channel, setChannel] = useState<OpenChannelResponse | null>(null)

  useEffect(() => {
    let active = true
    const poll = async () => {
      const ok = await checkHealth()
      if (active) setServerStatus(ok ? 'online' : 'offline')
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <AppHeader
        connected={wallet.connected}
        shortAddress={wallet.shortAddress}
        connecting={wallet.connecting}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
        hasPhantom={wallet.hasPhantom}
      />

      <ServerStatusStrip status={serverStatus} />

      <main id="main-content" className="flex-1" role="main">

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border" aria-label="Product overview">
          <div className="dot-pattern absolute inset-0 opacity-40" />

          {/* Glow orbs */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-primary/5 blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
            <div className="flex flex-col items-center text-center gap-5 sm:gap-6 max-w-3xl mx-auto">

              {/* Built by badge */}
              <a
                href="https://www.valiron.co"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 backdrop-blur px-3.5 py-1.5 hover:border-primary/30 hover:bg-primary/5 transition-all group"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Built by <span className="text-foreground">Valiron</span>
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" aria-hidden="true" />
              </a>

              {/* Headline */}
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance leading-[1.1]">
                Dynamic Payment Sessions{' '}
                <span className="text-primary">on Solana</span>
              </h1>

              {/* One-liner problem → solution */}
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl text-pretty">
                API providers have no guarantee they&apos;ll be paid — until now.
                Valiron locks payment in escrow before a session starts, so providers receive exactly what they&apos;re owed, settled on-chain in USDC.
              </p>

              {/* CTA row */}
              <div className="flex flex-col xs:flex-row items-center gap-3 mt-2">
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Try the Demo
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="https://www.valiron.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Join Waitlist
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mt-2 text-[11px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Escrow-backed
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Trust-scored agents
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  USDC on Solana
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  Live on Devnet
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Explanatory sections ─────────────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-12 sm:gap-20 stagger-children">
          {/* Value propositions */}
          <ValueProps />

          {/* How it works */}
          <HowItWorks />

          {/* Tier reference */}
          <TierTable activeTier={channel?.tier} />
        </div>

        {/* ── Demo section ─────────────────────────────────────────────────────── */}
        <section id="demo" className="border-t border-border bg-secondary/[0.02]" aria-labelledby="demo-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-8">

            {/* Section header */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-primary">Interactive Demo · Devnet</span>
              </div>
              <h2 id="demo-heading" className="text-xl font-bold text-foreground tracking-tight sm:text-2xl text-balance">
                Try a Dynamic Payment Session
              </h2>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed text-pretty">
                Connect your Phantom wallet, gate an agent through the Valiron trust layer, deposit USDC to escrow, and call live APIs — all settled on-chain.
              </p>
              {!wallet.connected && (
                <button
                  onClick={wallet.connect}
                  disabled={wallet.connecting}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  suppressHydrationWarning
                >
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  {wallet.connecting ? 'Connecting...' : wallet.hasPhantom ? 'Connect Phantom to Start' : 'Install Phantom to Start'}
                </button>
              )}
            </div>

            {/* Demo panels */}
            <div className="flex flex-col gap-6 stagger-children">
              {/* Step 1: Gate Agent & Open Channel */}
              <GateAgent
                walletAddress={wallet.address}
                signTransaction={wallet.signTransaction}
                onChannelOpened={(data) => setChannel(data)}
              />

              {/* Step 2: Consume APIs & Settle (appears once channel opens) */}
              {channel && <ConsumeSettle channel={channel} />}
            </div>
          </div>
        </section>

      </main>

      <AppFooter />
    </div>
  )
}
