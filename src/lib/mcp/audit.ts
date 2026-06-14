// Audit logging for MCP tool calls.
// In production, this writes to Supabase table mcp_audit_log.
// If the write fails, we log to stderr but never block the tool response.

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"

export interface McpAuditEntry {
  ownerId: string
  toolName: string
  args: unknown
  success: boolean
  error?: string
  durationMs: number
}

const MCP_AUDIT_ENABLED = process.env.MCP_AUDIT_ENABLED !== "false"

export async function logMcpToolCall(entry: McpAuditEntry): Promise<void> {
  if (!MCP_AUDIT_ENABLED) return

  try {
    const supabase = createServiceClient()
    await supabase.from("mcp_audit_log").insert({
      owner_id: entry.ownerId,
      tool_name: entry.toolName,
      args: entry.args,
      success: entry.success,
      error: entry.error ?? null,
      duration_ms: entry.durationMs,
    })
  } catch (err) {
    logger.warn("mcp-audit", "Failed to write audit log", {
      error: err instanceof Error ? err.message : String(err),
      tool: entry.toolName,
    })
  }
}
