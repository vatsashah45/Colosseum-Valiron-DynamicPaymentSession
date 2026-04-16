'use client'

import { Shield, Zap, CreditCard, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const STEPS = [
  {
    icon: Shield,
    step: '01',
    title: 'Trust Evaluation',
    description: 'Agent submits identity for trust scoring. A credit tier is assigned based on historical behavior and risk profile.',
  },
  {
    icon: CreditCard,
    step: '02',
    title: 'Channel Opens',
    description: 'A payment channel opens with a credit line, duration, and request cap. No on-chain transaction required upfront.',
  },
  {
    icon: Zap,
    step: '03',
    title: 'Instant Consumption',
    description: 'Agent consumes services instantly against the credit line. Each request is tracked off-chain with microsecond latency.',
  },
  {
    icon: Lock,
    step: '04',
    title: 'On-Chain Settlement',
    description: 'When done, the channel settles with a single USDC transaction on Solana. Unused credit returns to the agent.',
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="flex flex-col gap-8">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2" aria-hidden="true">Architecture</p>
        <h2 id="how-it-works-heading" className="text-xl font-bold text-foreground tracking-tight sm:text-2xl text-balance">How It Works</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed text-pretty">
          Trust-adaptive payment channels for AI agent economies
        </p>
      </div>
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Steps to use payment channels">
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
