'use client'

import { ShieldCheck, Vault, Zap } from 'lucide-react'

const PROPS = [
  {
    icon: Vault,
    title: 'Escrow-Guaranteed Payments',
    description:
      'Every session is backed by USDC locked in an on-chain escrow before a single request is served. API providers receive exactly what they are owed — no chargebacks, no disputes.',
    accent: 'text-primary',
    bg: 'bg-primary/5 border-primary/15',
    iconBg: 'bg-primary/10 border-primary/20',
  },
  {
    icon: ShieldCheck,
    title: 'Trust-Adaptive Credit Tiers',
    description:
      'Agents are scored before opening a session. Higher trust unlocks larger credit lines and longer sessions — rewarding reliable participants and protecting providers from bad actors.',
    accent: 'text-chart-2',
    bg: 'bg-chart-2/5 border-chart-2/15',
    iconBg: 'bg-chart-2/10 border-chart-2/20',
  },
  {
    icon: Zap,
    title: 'Instant Off-Chain Metering',
    description:
      'Usage is tracked off-chain at microsecond speed against the escrowed credit line. When the session closes, a single Solana transaction finalizes the payment and returns unused funds.',
    accent: 'text-chart-3',
    bg: 'bg-chart-3/5 border-chart-3/15',
    iconBg: 'bg-chart-3/10 border-chart-3/20',
  },
]

export function ValueProps() {
  return (
    <section aria-labelledby="value-props-heading" className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2" aria-hidden="true">Why Valiron</p>
        <h2 id="value-props-heading" className="text-xl font-bold text-foreground tracking-tight sm:text-2xl text-balance">
          Built for trust. Guaranteed by escrow.
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto leading-relaxed text-pretty">
          API providers lose revenue to fraud and failed payments. Valiron eliminates that risk with cryptographic escrow and on-chain settlement on Solana.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PROPS.map((prop) => {
          const Icon = prop.icon
          return (
            <div
              key={prop.title}
              className={`rounded-xl border p-5 flex flex-col gap-4 ${prop.bg}`}
            >
              <div className={`flex items-center justify-center h-10 w-10 rounded-xl border ${prop.iconBg}`} aria-hidden="true">
                <Icon className={`h-4.5 w-4.5 ${prop.accent}`} />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${prop.accent}`}>{prop.title}</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{prop.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
