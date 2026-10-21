"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useTitle } from "@/lib/useTitle"
import { PregnancyCard } from "@/components/health/PregnancyCard"
import { BabySummaryCard } from "@/components/baby/BabySummaryCard"
import { useChild } from "@/lib/queries/baby"
import { BiometricList } from "@/components/health/BiometricLog"
import { AppointmentList } from "@/components/health/AppointmentList"
import { ProtocolList } from "@/components/health/ProtocolList"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

const HealthCharts = dynamic(() => import("@/components/health/HealthCharts"), {
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface" />,
})
const BiometricLogDialog = dynamic(() => import("@/components/health/BiometricLog").then(m => ({ default: m.BiometricLogDialog })), { ssr: false })
const AddAppointmentDialog = dynamic(() => import("@/components/health/AppointmentList").then(m => ({ default: m.AddAppointmentDialog })), { ssr: false })
const AddProtocolDialog = dynamic(() => import("@/components/health/ProtocolList").then(m => ({ default: m.AddProtocolDialog })), { ssr: false })

export default function HealthPage() {
  useTitle("Health · Suganuma Ops Hub")
  const [bioOpen, setBioOpen] = useState(false)
  const [apptOpen, setApptOpen] = useState(false)
  const [protocolOpen, setProtocolOpen] = useState(false)
  const { data: child } = useChild()

  return (
    <SectionErrorBoundary label="HEALTH HUB">
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title text-health">
            HEALTH HUB
          </h1>
          <p className="text-[10px] font-mono text-on-surface/60 mt-0.5">
            Saúde da família, bebê e protocolos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProtocolOpen(true)}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/60 hover:border-on-surface/40 hover:text-on-surface/70 rounded-sm transition-colors"
          >
            + PROTOCOLO
          </button>
          <button
            onClick={() => setApptOpen(true)}
            className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/60 hover:border-on-surface/40 hover:text-on-surface/70 rounded-sm transition-colors"
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

      {/* Depois do nascimento o card da bebê substitui o acompanhamento da gravidez */}
      {child ? <BabySummaryCard /> : <PregnancyCard />}

      {/* Protocols */}
      <ProtocolList />

      {/* Appointments */}
      <AppointmentList />

      {/* Biometric log */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
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
    </SectionErrorBoundary>
  )
}
