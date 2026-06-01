"use client"

import { ANNUAL_COLORS, COLOR_LABELS } from "@/lib/annual-colors"
import { cn } from "@/lib/utils"

interface ColorLegendProps {
  activeColors: Set<string>
  onToggleColor: (color: string) => void
  onReset: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  dayWidth: number
}

export function ColorLegend({ activeColors, onToggleColor, onReset, onZoomIn, onZoomOut, dayWidth }: ColorLegendProps) {
  const isFiltered = activeColors.size > 0 && activeColors.size < ANNUAL_COLORS.length

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 print:hidden">
      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
        {ANNUAL_COLORS.map((color) => {
          const isActive = activeColors.size === 0 || activeColors.has(color)
          return (
            <button
              key={color}
              onClick={() => onToggleColor(color)}
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-mono transition-all border",
                isActive
                  ? "border-transparent opacity-100"
                  : "border-border/30 opacity-40 grayscale"
              )}
              title={COLOR_LABELS[color] || color}
            >
              <span
                className="w-2 h-2 rounded-full flex-none"
                style={{ backgroundColor: color }}
              />
              <span className="text-on-surface/70 hidden sm:inline">{COLOR_LABELS[color]}</span>
            </button>
          )
        })}
        {isFiltered && (
          <button
            onClick={onReset}
            className="text-[9px] font-mono text-teal hover:text-teal-hi underline ml-1"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 border-l border-border/30 pl-2">
        <button
          onClick={onZoomOut}
          disabled={dayWidth <= 14}
          className="w-6 h-6 flex items-center justify-center text-[11px] font-mono text-on-surface/60 bg-surface border border-border/50 rounded-sm hover:bg-surface/80 disabled:opacity-30"
          title="Diminuir"
        >
          −
        </button>
        <span className="text-[9px] font-mono text-on-surface/40 w-8 text-center">
          {dayWidth}px
        </span>
        <button
          onClick={onZoomIn}
          disabled={dayWidth >= 60}
          className="w-6 h-6 flex items-center justify-center text-[11px] font-mono text-on-surface/60 bg-surface border border-border/50 rounded-sm hover:bg-surface/80 disabled:opacity-30"
          title="Aumentar"
        >
          +
        </button>
      </div>
    </div>
  )
}
