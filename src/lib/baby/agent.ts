import { babyLogSchema, type BabyLog } from "@/lib/schemas/baby"

/**
 * Normaliza o corpo de POST /api/agent/baby/logs (vindo do MCP/agentes).
 *
 * - `at` é apelido amigável de `started_at`;
 * - o `child_id` SEMPRE é o da criança do dono do token (resolvido no servidor):
 *   um child_id vindo no corpo é sobrescrito, nunca confiado — rotas de agente
 *   usam service role e bypassam o RLS.
 */
export function normalizeAgentLog(
  body: unknown,
  ownerChildId: string,
): { success: true; data: BabyLog } | { success: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { success: false, error: "Corpo deve ser um objeto" }
  }
  const { at, ...rest } = body as Record<string, unknown>
  const candidate = {
    ...rest,
    ...(at !== undefined && rest.started_at === undefined ? { started_at: at } : {}),
    child_id: ownerChildId,
  }
  const parsed = babyLogSchema.safeParse(candidate)
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, error: JSON.stringify(parsed.error.flatten()) }
}
