import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { HealthLog, Pregnancy, Appointment, Protocol, ProtocolEntry } from "@/lib/schemas/health"
import type { HealthLogRow, PregnancyRow, AppointmentRow, ProtocolRow, ProtocolEntryRow } from "@/lib/types"
import { useRealtimeTable } from "@/lib/realtime"

export type { HealthLogRow, PregnancyRow, AppointmentRow, ProtocolRow, ProtocolEntryRow }

export const healthKeys = {
  all: ["health"] as const,
  logs: (kind?: string) => kind ? (["health", "logs", kind] as const) : (["health", "logs"] as const),
  pregnancy: ["health", "pregnancy"] as const,
  appointments: ["health", "appointments"] as const,
  protocols: ["health", "protocols"] as const,
  protocolEntries: (protocolId?: string) =>
    protocolId ? (["health", "protocol_entries", protocolId] as const) : (["health", "protocol_entries"] as const),
}

// ── Health Logs (biometrics) ──────────────────────────────

export function healthLogsOptions(kind?: string) {
  return queryOptions({
    queryKey: healthKeys.logs(kind),
    queryFn: async (): Promise<HealthLogRow[]> => {
      const supabase = createClient()
      let q = supabase.from("health_log").select("*").order("logged_at", { ascending: false })
      if (kind) q = q.eq("kind", kind)
      const { data, error } = await q.limit(50)
      if (error) throw error
      return (data ?? []) as HealthLogRow[]
    },
  })
}

export function useHealthLogs(kind?: string) {
  useRealtimeTable("health_log")
  return useQuery(healthLogsOptions(kind))
}

export function useCreateHealthLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (log: Omit<HealthLog, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("health_log")
        .insert({ ...log, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as HealthLogRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.logs() }),
  })
}

// ── Pregnancy ─────────────────────────────────────────────

const pregnancyOptions = queryOptions({
  queryKey: healthKeys.pregnancy,
  staleTime: Infinity,
  queryFn: async (): Promise<PregnancyRow | null> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("pregnancy")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data as PregnancyRow | null
  },
})

export function usePregnancy() {
  return useQuery(pregnancyOptions)
}

export function useUpsertPregnancy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pregnancy: Omit<Pregnancy, "id"> & { id?: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("pregnancy")
        .upsert({ ...pregnancy, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as PregnancyRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.pregnancy }),
  })
}

// ── Appointments ──────────────────────────────────────────

const appointmentsOptions = queryOptions({
  queryKey: healthKeys.appointments,
  queryFn: async (): Promise<AppointmentRow[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("appointment")
      .select("*")
      .order("starts_at", { ascending: true })
    if (error) throw error
    return (data ?? []) as AppointmentRow[]
  },
})

export function useAppointments() {
  return useQuery(appointmentsOptions)
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (appt: Omit<Appointment, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("appointment")
        .insert({ ...appt, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as AppointmentRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.appointments }),
  })
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("appointment").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.appointments }),
  })
}

// ── Protocols ─────────────────────────────────────────────

const protocolsOptions = queryOptions({
  queryKey: healthKeys.protocols,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<ProtocolRow[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("protocol")
      .select("*")
      .order("created_at", { ascending: true })
    if (error) throw error
    return (data ?? []) as ProtocolRow[]
  },
})

export function useProtocols() {
  return useQuery(protocolsOptions)
}

export function useCreateProtocol() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (protocol: Omit<Protocol, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("protocol")
        .insert({ ...protocol, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as ProtocolRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.protocols }),
  })
}

export function useUpdateProtocol() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<Omit<Protocol, "id">>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("protocol")
        .update(updates)
        .eq("id", id)
        .select().single()
      if (error) throw error
      return data as ProtocolRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: healthKeys.protocols }),
  })
}

export function useDeleteProtocol() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("protocol").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.protocols })
      queryClient.invalidateQueries({ queryKey: healthKeys.protocolEntries() })
    },
  })
}

export function protocolEntriesOptions(protocolId?: string) {
  return queryOptions({
    queryKey: healthKeys.protocolEntries(protocolId),
    enabled: !!protocolId,
    queryFn: async (): Promise<ProtocolEntryRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("protocol_entry")
        .select("*")
        .eq("protocol_id", protocolId!)
        .order("done_on", { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as ProtocolEntryRow[]
    },
  })
}

export function useProtocolEntries(protocolId?: string) {
  return useQuery(protocolEntriesOptions(protocolId))
}

export function useLogProtocolEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entry: Omit<ProtocolEntry, "id">) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("protocol_entry")
        .insert(entry)
        .select().single()
      if (error) throw error
      return data as ProtocolEntryRow
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: healthKeys.protocolEntries(vars.protocol_id) })
    },
  })
}
