'use client'

import { Check, Loader2, AlertCircle, Send, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaymentStep } from '@/lib/types'

const STEPS: { key: PaymentStep; label: string; shortLabel: string; icon: typeof Send }[] = [
  { key: 'submitting', label: 'Settling', shortLabel: 'Settle', icon: Send },
  { key: 'confirmed', label: 'Complete', shortLabel: 'Done', icon: CheckCircle2 },
]

interface PaymentStepsProps {
  currentStep: PaymentStep
  error?: string | null
}

export function PaymentSteps({ currentStep, error }: PaymentStepsProps) {
  if (currentStep === 'idle') return null

  const isError = currentStep === 'error'
  const isAllDone = currentStep === 'confirmed'
  // When in error state, show all steps as failed from the last one
  const currentIndex = isError ? STEPS.length - 1 : STEPS.findIndex((s) => s.key === currentStep)

  const currentStepName = STEPS[currentIndex]?.label || 'Processing'
  const progressPercent = isError ? 100 : Math.round((currentIndex / (STEPS.length - 1)) * 100)

  return (
    <section 
      aria-labelledby="settlement-progress-heading"
      aria-describedby="settlement-progress-status"
      className="rounded-xl border border-border bg-secondary/20 p-3 sm:p-5"
    >
      <h3 id="settlement-progress-heading" className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground mb-3 sm:mb-4 font-semibold">Settlement Progress</h3>
      <p id="settlement-progress-status" className="sr-only">
        {isError ? `Error at step: ${currentStepName}` : `Step ${currentIndex + 1} of ${STEPS.length}: ${currentStepName}. ${progressPercent}% complete.`}
      </p>
      <ol className="flex items-center gap-0.5 sm:gap-1.5" aria-label="Settlement steps">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon
          const isComplete = isAllDone || (!isError && currentIndex > i)
          const isCurrent = !isAllDone && !isError && currentIndex === i
          const isPending = !isAllDone && !isError && currentIndex < i
          const stepStatus = isComplete ? 'complete' : isCurrent ? 'current' : 'pending'

          return (
            <li 
              key={step.key} 
              className="flex items-center gap-0.5 sm:gap-1.5 flex-1"
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex flex-col items-center gap-1 sm:gap-1.5 flex-1">
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex items-center justify-center h-6 w-6 sm:h-8 sm:w-8 rounded-full border-2 transition-all',
                    isComplete && 'bg-primary/20 border-primary text-primary',
                    isCurrent && 'bg-primary/10 border-primary/60 text-primary animate-pulse',
                    isPending && 'bg-secondary/60 border-border text-muted-foreground',
                    isError && i === currentIndex && 'bg-destructive/10 border-destructive text-destructive'
                  )}
                >
                  {isComplete ? (
                    <Check className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 animate-spin" />
                  ) : (
                    <StepIcon className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[8px] sm:text-[10px] font-semibold text-center',
                    isComplete && 'text-primary',
                    isCurrent && 'text-primary',
                    isPending && 'text-muted-foreground',
                    isError && 'text-destructive'
                  )}
                >
                  <span className="hidden xs:inline">{step.label}</span>
                  <span className="xs:hidden" aria-hidden="true">{step.shortLabel}</span>
                  <span className="sr-only">{step.label} - {stepStatus}</span>
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'h-0.5 flex-1 mb-4 sm:mb-5 rounded-full transition-colors',
                    isComplete ? 'bg-primary/50' : 'bg-border'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
      {isError && error && (
        <div role="alert" className="flex items-center gap-2 sm:gap-2.5 mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive shrink-0" aria-hidden="true" />
          <span className="text-[11px] sm:text-xs text-destructive font-medium">{error}</span>
        </div>
      )}
    </section>
  )
}
