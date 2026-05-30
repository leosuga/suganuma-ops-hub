"use client"

import { useTitle } from "@/lib/useTitle"
import { YearView } from "@/components/annual/YearView"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import Link from "next/link"

export default function YearCalendarPage() {
  useTitle("Year Calendar · Suganuma Ops Hub")

  return (
    <SectionErrorBoundary label="YEAR CALENDAR">
      <div className="h-full flex flex-col">
        <YearView />
      </div>
    </SectionErrorBoundary>
  )
}
