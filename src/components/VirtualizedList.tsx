"use client"

import { useRef, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

interface VirtualizedListProps {
  items: unknown[]
  /** Altura estimada — com dynamic, é apenas a estimativa inicial (real medida via ResizeObserver). */
  rowHeight: number
  overscan?: number
  renderRow: (index: number) => React.ReactNode
}

export function VirtualizedList({ items, rowHeight, overscan = 10, renderRow }: VirtualizedListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
    // Medição dinâmica: rows podem ter alturas distintas (ex: NoteRow com
    // preview 2 linhas vs 5). getVirtualItems + measureElement realinham.
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  useEffect(() => {
    if (parentRef.current && virtualizer.scrollElement !== parentRef.current) {
      virtualizer.scrollElement = parentRef.current
    }
  }, [virtualizer])

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  )
}