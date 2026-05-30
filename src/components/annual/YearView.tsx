"use client"

import { MonthColumn } from "./MonthColumn"
import { YearNavigator } from "./YearNavigator"
import { EventDialog } from "./EventDialog"
import {
  useAnnualEvents,
  useCreateAnnualEvent,
  useUpdateAnnualEvent,
  useDeleteAnnualEvent,
} from "@/lib/queries/annual"
import { useState } from "react"
import type { AnnualEventRow } from "@/lib/types"

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
]

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysForMonth(year: number, month: number): number {
  if (month === 1 && isLeap(year)) return 29
  return DAYS_IN_MONTH[month]
}

export function YearView() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const { data: events = [], isLoading } = useAnnualEvents(year)

  const createEvent = useCreateAnnualEvent()
  const updateEvent = useUpdateAnnualEvent()
  const deleteEvent = useDeleteAnnualEvent()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AnnualEventRow | null>(null)
  const [newDate, setNewDate] = useState<string | null>(null)

  function handleNewEvent(dateStr: string) {
    setEditingEvent(null)
    setNewDate(dateStr)
    setDialogOpen(true)
  }

  function handleEditEvent(event: AnnualEventRow) {
    setEditingEvent(event)
    setNewDate(null)
    setDialogOpen(true)
  }

  function handleSave(title: string, start: string, end: string, color: string) {
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, title, start_date: start, end_date: end, color })
    } else if (newDate) {
      createEvent.mutate({ title, start_date: start, end_date: end, color })
    }
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  function handleDeleteEvent() {
    if (editingEvent) {
      deleteEvent.mutate(editingEvent.id)
      setDialogOpen(false)
      setEditingEvent(null)
      setNewDate(null)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <YearNavigator year={year} onChange={setYear} />

      <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
        <div className="flex h-full" style={{ minWidth: "max-content" }}>
          {isLoading ? (
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-[10px] font-mono text-on-surface/30">Carregando...</span>
            </div>
          ) : (
            MONTHS.map((monthLabel, monthIdx) => {
              const days = daysForMonth(year, monthIdx)
              return (
                <MonthColumn
                  key={monthIdx}
                  year={year}
                  month={monthIdx}
                  monthLabel={monthLabel}
                  days={days}
                  events={events}
                  onNewEvent={handleNewEvent}
                  onEditEvent={handleEditEvent}
                  onUpdateEvent={(id, start, end) =>
                    updateEvent.mutate({ id, start_date: start, end_date: end })
                  }
                />
              )
            })
          )}
        </div>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialEvent={editingEvent}
        initialDate={newDate}
        onSave={handleSave}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}
