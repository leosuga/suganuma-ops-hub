"use client"

import { useState } from "react"
import { useHealthLogs } from "@/lib/queries/health"
import { PregnancyCard } from "@/components/health/PregnancyCard"
import { BiometricList, BiometricLogDialog } from "@/components/health/BiometricLog"
import { AppointmentList, AddAppointmentDialog } from "@/components/health/AppointmentList"
import { ProtocolList, AddProtocolDialog } from "@/components/health/ProtocolList"
import { WeightChart, BloodPressureChart } from "@/components/health/HealthTrends"

function HealthCharts() {
  const { data: logs = [] } = useHealthLogs()

  if (logs.length === 0) return null

  const hasWeight = logs.some((l) => l.kind === "weight")
  const hasBp = logs.some((l) => l.kind === "blood_pressure")

  if (!hasWeight && !hasBp) return null

  return (
    <section className="space-y-3">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        TENDÊNCIAS
      </span>
      {hasWeight && <WeightChart logs={logs} kind="weight" />}
      {hasBp && <BloodPressureChart logs={logs} kind="blood_pressure" />}
    </section>
  )
}

export default function HealthPage() {
  const [bioOpen, setBioOpen] = useState(false)
  const [apptOpen, setApptOpen] = useState(false)
  const [protocolOpen, setProtocolOpen] = useState(false)

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-health uppercase">
            HEALTH HUB
          </h1>
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
            Saúde, gravidez e protocolos familiares
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProtocolOpen(true)}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/40 hover:border-on-surface/40 hover:text-on-surface/70 rounded-sm transition-colors"
          >
            + PROTOCOLO
          </button>
          <button
            onClick={() => setApptOpen(true)}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/40 hover:border-on-surface/40 hover:text-on-surface/70 rounded-sm transition-colors"
          >
            + CONSULTA
          </button>
          <button
            onClick={() => setBioOpen(true)}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-health text-health hover:bg-health/10 rounded-sm transition-colors"
          >
            + BIOMETRIA
          </button>
        </div>
      </div>

      {/* Pregnancy tracker */}
      <PregnancyCard />

      {/* Protocols */}
      <ProtocolList />

      {/* Appointments */}
      <AppointmentList />

      {/* Biometric log */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            BIOMETRIA RECENTE
          </span>
        </div>
        <BiometricList />
      </section>

      {/* Charts */}
      <HealthCharts />

      {/* Dialogs */}
      <BiometricLogDialog open={bioOpen} onOpenChange={setBioOpen} />
      <AddAppointmentDialog open={apptOpen} onOpenChange={setApptOpen} />
      <AddProtocolDialog open={protocolOpen} onOpenChange={setProtocolOpen} />
    </div>
  )
}
