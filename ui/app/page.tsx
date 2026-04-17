'use client'

import { useState, useEffect } from 'react'
import { AppHeader } from '@/components/app-header'
import { ServerStatusStrip } from '@/components/server-status'
import { GateAgent } from '@/components/gate-agent'
import { ConsumeSettle } from '@/components/consume-settle'
import { TierTable } from '@/components/tier-table'
import { HowItWorks } from '@/components/how-it-works'
import { AppFooter } from '@/components/app-footer'
import { useWallet } from '@/hooks/use-wallet'
import { checkHealth } from '@/lib/api'
import type { OpenChannelResponse, ServerStatus } from '@/lib/types'

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
        {/* Hero intro */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="dot-pattern absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
            <div className="flex flex-col items-center text-center gap-3 sm:gap-4 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 sm:px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] sm:text-xs font-medium text-primary">Live on Devnet</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl text-balance">
                Trust-Adaptive Payment Channels for AI Agents
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg text-pretty">
                Gate agents by trust score, open credit-backed channels instantly,
                consume services off-chain, and settle in USDC on Solana.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-10 stagger-children">
          {/* Section 1: Gate Agent */}
          <GateAgent
            walletAddress={wallet.address}
            signTransaction={wallet.signTransaction}
            onChannelOpened={(data) => setChannel(data)}
          />

          {/* Section 2: Consume & Settle (visible once channel opens) */}
          {channel && <ConsumeSettle channel={channel} />}

          {/* Section 3: Tier Policy Table */}
          <TierTable activeTier={channel?.tier} />

          {/* Section 4: How It Works */}
          <HowItWorks />
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
