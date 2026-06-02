"use client"

import { useState } from "react"
import Link from "next/link"
import { EventDialog } from "@/components/annual/EventDialog"
import {
  useAnnualEvents,
  useUpdateAnnualEvent,
  useDeleteAnnualEvent,
  useCreateAnnualEvent,
} from "@/lib/queries/annual"
import { useUndoToast } from "@/components/UndoToast"
import type { AnnualEventRow } from "@/lib/types"

export function UpcomingEvents() {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const year = now.getFullYear()

  const { data: events = [], isLoading } = useAnnualEvents(year)
  const updateEvent = useUpdateAnnualEvent()
  const deleteEvent = useDeleteAnnualEvent()
  const createEvent = useCreateAnnualEvent()
  const { show: showToast } = useUndoToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AnnualEventRow | null>(null)
  const [newDate, setNewDate] = useState<string | null>(null)

  const upcoming = events
    .filter((e) => e.end_date >= todayStr)
    .sort((a, b) => {
      const da = new Date(a.start_date + "T00:00:00")
      const db = new Date(b.start_date + "T00:00:00")
      return da.getTime() - db.getTime()
    })
    .slice(0, 5)

  function handleEdit(event: AnnualEventRow) {
    setEditingEvent(event)
    setNewDate(null)
    setDialogOpen(true)
  }

  function handleNew() {
    setEditingEvent(null)
    setNewDate(todayStr)
    setDialogOpen(true)
  }

  function handleSave(
    title: string,
    start: string,
    end: string,
    color: string,
    recurrence: string,
    projectId: string | null,
    startTime: string | null,
    endTime: string | null,
    isAllDay: boolean
  ) {
    if (editingEvent) {
      updateEvent.mutate({
        id: editingEvent.id,
        title,
        start_date: start,
        end_date: end,
        color,
        recurrence,
        project_id: projectId,
        start_time: startTime,
        end_time: endTime,
        is_all_day: isAllDay,
      })
    } else if (newDate) {
      createEvent.mutate({
        title,
        start_date: start,
        end_date: end,
        color,
        recurrence,
        project_id: projectId,
        start_time: startTime,
        end_time: endTime,
        is_all_day: isAllDay,
      })
    }
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  function handleDelete() {
    if (editingEvent) {
      const snapshot = { ...editingEvent }
      deleteEvent.mutate(editingEvent.id)
      setDialogOpen(false)
      setEditingEvent(null)
      setNewDate(null)
      showToast({
        label: `Evento "${snapshot.title}" excluído`,
        onUndo: () => {
          createEvent.mutate({
            title: snapshot.title,
            start_date: snapshot.start_date,
            end_date: snapshot.end_date,
            color: snapshot.color,
            recurrence: snapshot.recurrence,
            project_id: snapshot.project_id,
            start_time: snapshot.start_time,
            end_time: snapshot.end_time,
            is_all_day: snapshot.is_all_day,
          })
        },
      })
    }
  }

  if (isLoading) return null

  const hasEvents = upcoming.length > 0

  return (
    <>
      <div className="border border-border bg-surface rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            PRÓXIMOS EVENTOS
          </span>
          <div className="flex items-center gap-3">
            {!hasEvents && (
              <button
                onClick={handleNew}
                className="text-[9px] font-mono text-teal hover:text-teal/80 transition-colors"
              >
                + CRIAR
              </button>
            )}
            <Link
              href="/calendar/year"
              className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors"
            >
              CALENDÁRIO →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-border">
          {hasEvents ? (
            upcoming.map((event) => {
              const start = new Date(event.start_date + "T00:00:00")
              const end = new Date(event.end_date + "T00:00:00")
              const dateStr = start.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })
              const isSingleDay = event.start_date === event.end_date
              const endStr = isSingleDay
                ? ""
                : ` → ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
              const timeStr = event.start_time
                ? ` ${event.start_time.slice(0, 5)}`
                : ""

              return (
                <button
                  key={event.id}
                  onClick={() => handleEdit(event)}
                  className="w-full flex items-center gap-3 h-10 px-4 hover:bg-bg/50 transition-colors text-left"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-none"
                    style={{ backgroundColor: event.color }}
                  />
                  <span className="text-[10px] font-mono text-on-surface/50 w-20 flex-none">
                    {dateStr}
                    {endStr}
                    <span className="text-teal">{timeStr}</span>
                  </span>
                  <span className="flex-1 text-[12px] font-mono text-on-surface truncate">
                    {event.title}
                  </span>
                  {event.project_name && (
                    <span className="text-[10px] font-mono text-on-surface/30 truncate max-w-[80px]">
                      {event.project_name}
                    </span>
                  )}
                </button>
              )
            })
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] font-mono text-on-surface/30">
                Nenhum evento nos próximos dias
              </p>
              <button
                onClick={handleNew}
                className="mt-2 text-[10px] font-mono text-teal hover:text-teal/80 transition-colors"
              >
                + Criar evento
              </button>
            </div>
          )}
        </div>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialEvent={editingEvent}
        initialDate={newDate}
        onSave={handleSave}
        onDelete={editingEvent ? handleDelete : undefined}
      />
    </>
  )
}
