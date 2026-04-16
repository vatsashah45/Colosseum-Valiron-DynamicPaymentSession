'use client'

import { cn } from '@/lib/utils'

interface GaugeProps {
  label: string
  value: number
  max: number
  displayValue: string
  unit?: string
  colorClass?: string
  icon?: React.ReactNode
}

export function Gauge({ label, value, max, displayValue, unit, colorClass = 'text-primary', icon }: GaugeProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const getStrokeColor = () => {
    if (percentage > 75) return 'stroke-primary'
    if (percentage > 40) return 'stroke-warning'
    return 'stroke-destructive'
  }

  return (
    <div 
      className="flex flex-col items-center gap-1.5 sm:gap-2.5"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${label}: ${displayValue}${unit ? ` ${unit}` : ''}`}
    >
      <div className="relative h-20 w-20 sm:h-28 sm:w-28" aria-hidden="true">
        <svg className="h-20 w-20 sm:h-28 sm:w-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-secondary/60"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn('transition-all duration-700 ease-out', getStrokeColor())}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <div className={cn('mb-0.5 sm:mb-1 opacity-60 [&>svg]:h-2.5 [&>svg]:w-2.5 sm:[&>svg]:h-3 sm:[&>svg]:w-3', colorClass)}>{icon}</div>}
          <span className={cn('text-sm sm:text-base font-mono font-bold', colorClass)}>{displayValue}</span>
          {unit && <span className="text-[9px] sm:text-[10px] text-muted-foreground font-mono">{unit}</span>}
        </div>
      </div>
      <span className="text-[9px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  )
}
