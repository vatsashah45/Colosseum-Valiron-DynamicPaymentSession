'use client'

import { ShieldCheck, Vault, Zap, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STEPS = [
  {
    icon: ShieldCheck,
    step: '01',
    title: 'Trust Scoring',
    description: 'The agent is evaluated by the Valiron trust gate. A credit tier (AAA → B) is assigned based on behavioral history and risk profile — before a single request is allowed.',
  },
  {
    icon: Vault,
    step: '02',
    title: 'Escrow Deposit',
    description: 'USDC equal to the credit line is deposited into a Solana escrow account. The provider sees the on-chain confirmation before the session opens — zero counterparty risk.',
  },
  {
    icon: Zap,
    step: '03',
    title: 'Off-Chain Metering',
    description: 'Each API call is metered against the escrowed credit in real time. No on-chain transaction per request — just instant, sub-millisecond accounting against the locked funds.',
  },
  {
    icon: CheckCircle,
    step: '04',
    title: 'On-Chain Settlement',
    description: 'At session end, one Solana transaction settles the balance: the provider receives exactly what was consumed, and any unused USDC returns to the consumer automatically.',
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2" aria-hidden="true">How It Works</p>
        <h2 id="how-it-works-heading" className="text-xl font-bold text-foreground tracking-tight sm:text-2xl text-balance">
          Four steps. One guaranteed payment.
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed text-pretty">
          From trust check to on-chain settlement — every step is designed so providers get paid and consumers stay in control.
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="How Dynamic Payment Sessions work">
        {STEPS.map((step, index) => (
          <li key={step.step}>
            <Card className="border-border bg-card hover:border-primary/30 transition-all group relative overflow-hidden h-full">
              <CardContent className="pt-6 pb-5 px-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/15 group-hover:border-primary/30 transition-all" aria-hidden="true">
                    <step.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="text-2xl font-mono font-bold text-muted-foreground/20 group-hover:text-muted-foreground/30 transition-colors" aria-hidden="true">{step.step}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}
