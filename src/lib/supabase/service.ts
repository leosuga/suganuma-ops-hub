import { createClient } from "@supabase/supabase-js"

// Usa service role key para operações de agente (sem RLS).
// Sem generic <Database> porque @supabase/supabase-js tem generics
// incompatíveis com o formato do database.types.ts gerado manualmente.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
