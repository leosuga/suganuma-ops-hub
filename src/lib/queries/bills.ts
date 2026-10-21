import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import type { BillPaymentRow, RecurringBillInsert, RecurringBillRow } from "@/lib/types/bill"

export const billKeys = {
  recurring: ["bills", "recurring"] as const,
  payments: (period: string) => ["bills", "payments", period] as const,
}

/** Despesas fixas / contas a pagar cadastradas. */
export function useRecurringBills() {
  useRealtimeTable("recurring_transaction")
  return useQuery(
    queryOptions({
      queryKey: billKeys.recurring,
      staleTime: 5 * 60_000,
      queryFn: async (): Promise<RecurringBillRow[]> => {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("recurring_transaction")
          .select("*")
          .order("day_of_month", { ascending: true })
        if (error) throw error
        return (data ?? []) as RecurringBillRow[]
      },
    })
  )
}

/** Pagamentos de um período ('YYYY-MM'). */
export function useBillPayments(period: string, enabled = true) {
  useRealtimeTable("bill_payment")
  return useQuery(
    queryOptions({
      queryKey: billKeys.payments(period),
      enabled,
      staleTime: 60_000,
      queryFn: async (): Promise<BillPaymentRow[]> => {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("bill_payment")
          .select("*")
          .eq("period", period)
        if (error) throw error
        return (data ?? []) as BillPaymentRow[]
      },
    })
  )
}

export function useMarkBillPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      recurring_id,
      period,
      paid,
    }: {
      recurring_id: string
      period: string
      paid: boolean
    }) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      if (paid) {
        const { error } = await supabase
          .from("bill_payment")
          .upsert(
            { owner_id: user.id, recurring_id, period, paid_at: new Date().toISOString() },
            { onConflict: "owner_id,recurring_id,period" },
          )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("bill_payment")
          .delete()
          .eq("recurring_id", recurring_id)
          .eq("period", period)
        if (error) throw error
      }
      return { recurring_id, period, paid }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: billKeys.payments(vars.period) })
    },
  })
}

export function useCreateRecurringBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecurringBillInsert) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("recurring_transaction")
        .insert({ ...input, owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as RecurringBillRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.recurring })
    },
  })
}

export function useUpdateRecurringBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<RecurringBillInsert>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("recurring_transaction")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as RecurringBillRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.recurring })
    },
  })
}

export function useDeleteRecurringBill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("recurring_transaction").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billKeys.recurring })
    },
  })
}
