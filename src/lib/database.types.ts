// Tipos gerados manualmente a partir das migrations SQL.
// Para regenerar via CLI: npm run types:supabase
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profile: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
      }
      task: {
        Row: {
          id: string
          owner_id: string
          title: string
          notes: string | null
          category: "finance" | "logistics" | "personal" | "health"
          status: "todo" | "doing" | "done" | "archived"
          priority: "low" | "med" | "high" | "urgent"
          due_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          notes?: string | null
          category?: "finance" | "logistics" | "personal" | "health"
          status?: "todo" | "doing" | "done" | "archived"
          priority?: "low" | "med" | "high" | "urgent"
          due_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          notes?: string | null
          category?: "finance" | "logistics" | "personal" | "health"
          status?: "todo" | "doing" | "done" | "archived"
          priority?: "low" | "med" | "high" | "urgent"
          due_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      account: {
        Row: {
          id: string
          owner_id: string
          name: string
          kind: string | null
          currency: string
          opening_balance: number
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          kind?: string | null
          currency?: string
          opening_balance?: number
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          kind?: string | null
          currency?: string
          opening_balance?: number
          created_at?: string
        }
      }
      transaction: {
        Row: {
          id: string
          owner_id: string
          account_id: string | null
          kind: "income" | "expense" | "transfer" | "tax"
          amount: number
          currency: string
          category: string | null
          description: string | null
          occurred_on: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          account_id?: string | null
          kind: "income" | "expense" | "transfer" | "tax"
          amount: number
          currency?: string
          category?: string | null
          description?: string | null
          occurred_on: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          account_id?: string | null
          kind?: "income" | "expense" | "transfer" | "tax"
          amount?: number
          currency?: string
          category?: string | null
          description?: string | null
          occurred_on?: string
          created_at?: string
        }
      }
      csv_import: {
        Row: {
          id: string
          owner_id: string
          filename: string | null
          rows_imported: number | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          filename?: string | null
          rows_imported?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          filename?: string | null
          rows_imported?: number | null
          created_at?: string
        }
      }
      health_log: {
        Row: {
          id: string
          owner_id: string
          kind: string
          value: Json
          logged_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          kind: string
          value: Json
          logged_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          kind?: string
          value?: Json
          logged_at?: string
        }
      }
      pregnancy: {
        Row: {
          id: string
          owner_id: string
          due_date: string | null
          week: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          due_date?: string | null
          week?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          due_date?: string | null
          week?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      appointment: {
        Row: {
          id: string
          owner_id: string
          title: string
          starts_at: string
          location: string | null
          kind: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          starts_at: string
          location?: string | null
          kind?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          starts_at?: string
          location?: string | null
          kind?: string | null
          created_at?: string
        }
      }
      protocol: {
        Row: {
          id: string
          owner_id: string
          name: string
          schedule: Json | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          schedule?: Json | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          schedule?: Json | null
          active?: boolean
          created_at?: string
        }
      }
      protocol_entry: {
        Row: {
          id: string
          protocol_id: string
          done_on: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          protocol_id: string
          done_on: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          protocol_id?: string
          done_on?: string
          notes?: string | null
          created_at?: string
        }
      }
    }
    Enums: {
      task_category: "finance" | "logistics" | "personal" | "health"
      task_status: "todo" | "doing" | "done" | "archived"
      task_priority: "low" | "med" | "high" | "urgent"
      txn_kind: "income" | "expense" | "transfer" | "tax"
    }
  }
}
