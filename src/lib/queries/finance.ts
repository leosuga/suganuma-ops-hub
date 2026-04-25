import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Account, Transaction } from "@/lib/schemas/finance"
import type { Database } from "@/lib/database.types"
import { logger } from "@/lib/logger"
import { useRealtimeTable } from "@/lib/realtime"

export type AccountRow = Database["public"]["Tables"]["account"]["Row"]
export type TransactionRow = Database["public"]["Tables"]["transaction"]["Row"]

export const financeKeys = {
  all: ["finance"] as const,
  accounts: ["finance", "accounts"] as const,
  transactions: (filters?: TransactionFilters) =>
    filters ? (["finance", "transactions", filters] as const) : (["finance", "transactions"] as const),
}

export interface TransactionFilters {
  account_id?: string
  kind?: string
  month?: string // YYYY-MM
}

// ── Accounts ──────────────────────────────────────────────

export function useAccounts() {
  return useQuery({
    queryKey: financeKeys.accounts,
    queryFn: async (): Promise<AccountRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("account")
        .select("*")
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as AccountRow[]
    },
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (account: Omit<Account, "id">) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("account")
        .insert({ ...account, owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as AccountRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.accounts })
    },
  })
}

// ── Transactions ──────────────────────────────────────────

export function useTransactions(filters?: TransactionFilters) {
  useRealtimeTable("transaction", financeKeys.all)
  return useQuery({
    queryKey: financeKeys.transactions(filters),
    queryFn: async (): Promise<TransactionRow[]> => {
      const supabase = createClient()
      let q = supabase.from("transaction").select("*")

      if (filters?.account_id) q = q.eq("account_id", filters.account_id)
      if (filters?.kind) q = q.eq("kind", filters.kind)
      if (filters?.month) {
        const [year, month] = filters.month.split("-")
        const from = `${year}-${month}-01`
        const nextMonth = parseInt(month) === 12 ? `${parseInt(year) + 1}-01-01` : `${year}-${String(parseInt(month) + 1).padStart(2, "0")}-01`
        q = q.gte("occurred_on", from).lt("occurred_on", nextMonth)
      }

      const { data, error } = await q.order("occurred_on", { ascending: false })
      if (error) throw error
      return (data ?? []) as TransactionRow[]
    },
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (txn: Omit<Transaction, "id">) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("transaction")
        .insert({ ...txn, owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as TransactionRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<Omit<Transaction, "id">>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("transaction")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as TransactionRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("transaction").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useImportCSV() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      rows,
      filename,
    }: {
      rows: Omit<Transaction, "id">[]
      filename: string
    }) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const withOwner = rows.map((r) => ({ ...r, owner_id: user.id }))
      const { error: txnError } = await supabase.from("transaction").insert(withOwner)
      if (txnError) {
        logger.error("useImportCSV", "batch insert failed", { filename, rows: rows.length, error: txnError.message })
        throw txnError
      }

      const { error: importError } = await supabase
        .from("csv_import")
        .insert({ owner_id: user.id, filename, rows_imported: rows.length })
      if (importError) {
        logger.warn("useImportCSV", "csv_import log failed", { error: importError.message })
      }

      logger.info("useImportCSV", "import complete", { filename, inserted: rows.length })
      return { inserted: rows.length, skipped: 0 }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}
