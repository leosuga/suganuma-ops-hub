import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import type {
  PersonRow,
  PersonRelationRow,
  PersonConflictRow,
  GuestEventRow,
  GuestInviteRow,
  InviteStatus,
} from "@/lib/types"
import type { Person, PersonConflict, PersonRelation, GuestEvent } from "@/lib/schemas/people"

// PGRST_DB_MAX_ROWS=1000 no PostgREST do VPS trunca SILENCIOSAMENTE toda
// query sem .range(). Foi esse bug que deixou /notes vazia em todos os
// devices. Volume baixo hoje não é desculpa.
const PAGE = 1000

async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

async function currentUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export const peopleKeys = {
  all: ["people"] as const,
  persons: ["people", "person"] as const,
  relations: ["people", "relation"] as const,
  conflicts: ["people", "conflict"] as const,
  events: ["people", "event"] as const,
  invites: (eventId: string) => ["people", "invite", eventId] as const,
}

// ------------------------------------------------------------------ person

export const peopleOptions = queryOptions({
  queryKey: peopleKeys.persons,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<PersonRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    return fetchAllPages<PersonRow>((from, to) =>
      supabase
        .from("person")
        .select("*")
        .eq("owner_id", ownerId)
        .order("name", { ascending: true })
        .range(from, to),
    )
  },
})

export function usePeople() {
  useRealtimeTable("person")
  return useQuery(peopleOptions)
}

export function useCreatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (person: Person): Promise<PersonRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = person
      const { data, error } = await supabase
        .from("person")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as PersonRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useUpdatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: Person & { id: string }): Promise<PersonRow> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("person")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as PersonRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useDeletePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("person").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// ---------------------------------------------------------- person_relation

export const relationsOptions = queryOptions({
  queryKey: peopleKeys.relations,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<PersonRelationRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    return fetchAllPages<PersonRelationRow>((from, to) =>
      supabase
        .from("person_relation")
        .select("*")
        .eq("owner_id", ownerId)
        .range(from, to),
    )
  },
})

export function useRelations() {
  useRealtimeTable("person_relation")
  return useQuery(relationsOptions)
}

export function useCreateRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (relation: PersonRelation): Promise<PersonRelationRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = relation
      const { data, error } = await supabase
        .from("person_relation")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as PersonRelationRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useDeleteRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("person_relation").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// ---------------------------------------------------------- person_conflict

export const conflictsOptions = queryOptions({
  queryKey: peopleKeys.conflicts,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<PersonConflictRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    return fetchAllPages<PersonConflictRow>((from, to) =>
      supabase
        .from("person_conflict")
        .select("*")
        .eq("owner_id", ownerId)
        .range(from, to),
    )
  },
})

export function useConflicts() {
  useRealtimeTable("person_conflict")
  return useQuery(conflictsOptions)
}

export function useCreateConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conflict: PersonConflict): Promise<PersonConflictRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = conflict
      const { data, error } = await supabase
        .from("person_conflict")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as PersonConflictRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useUpdateConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: PersonConflict & { id: string }): Promise<PersonConflictRow> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("person_conflict")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as PersonConflictRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useDeleteConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("person_conflict").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// -------------------------------------------------------------- guest_event

export const guestEventsOptions = queryOptions({
  queryKey: peopleKeys.events,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<GuestEventRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    const { data, error } = await supabase
      .from("guest_event")
      .select("*")
      .eq("owner_id", ownerId)
      .order("event_date", { ascending: false, nullsFirst: false })
      .range(0, PAGE - 1)
    if (error) throw error
    return (data ?? []) as GuestEventRow[]
  },
})

export function useGuestEvents() {
  useRealtimeTable("guest_event")
  return useQuery(guestEventsOptions)
}

export function useCreateGuestEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (event: GuestEvent): Promise<GuestEventRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = event
      const { data, error } = await supabase
        .from("guest_event")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as GuestEventRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// ------------------------------------------------------------- guest_invite

export function guestInvitesOptions(eventId: string) {
  return queryOptions({
    queryKey: peopleKeys.invites(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
    queryFn: async (): Promise<GuestInviteRow[]> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      return fetchAllPages<GuestInviteRow>((from, to) =>
        supabase
          .from("guest_invite")
          .select("*")
          .eq("owner_id", ownerId)
          .eq("event_id", eventId)
          .range(from, to),
      )
    },
  })
}

export function useGuestInvites(eventId: string) {
  useRealtimeTable("guest_invite")
  return useQuery(guestInvitesOptions(eventId))
}

/**
 * Um clique na tela muda o status de UMA pessoa naquele evento. Upsert com
 * onConflict na unique (event_id, person_id): a primeira marcação cria a
 * linha, as seguintes atualizam. Evita o par lookup+insert/update que já
 * causou linhas duplicadas em budget e meal_plan neste projeto.
 */
export function useUpsertInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      eventId: string
      personId: string
      status: InviteStatus
    }): Promise<GuestInviteRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { data, error } = await supabase
        .from("guest_invite")
        .upsert(
          {
            owner_id: ownerId,
            event_id: input.eventId,
            person_id: input.personId,
            status: input.status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "event_id,person_id" },
        )
        .select("*")
        .single()
      if (error) throw error
      return data as GuestInviteRow
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: peopleKeys.invites(vars.eventId) }),
  })
}
