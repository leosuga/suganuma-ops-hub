// Listas explícitas de colunas para as leituras que voltam para fora do app
// (rotas de agente/MCP e telas que já paginam).
//
// `select("*")` devolvia também `search_vector` — tsvector da busca híbrida
// (migration 0033), que cresce com o conteúdo de cada linha e nunca é lido:
// nas rotas de agente ele ia direto para o payload HTTP e consumia contexto de
// todo cliente MCP.
//
// ⚠️ Ao adicionar coluna nova em `note` ou `task` (migration), inclua-a aqui —
// caso contrário a coluna some dessas respostas sem nenhum erro.
// Só `note` e `task` têm tsvector; as demais tabelas seguem com `select("*")`.

/** Colunas de `note`, sem `search_vector`. */
export const NOTE_COLUMNS =
  "id, owner_id, title, content, tags, pinned, linked_task_id, para, daily_date, is_moc, last_review, project_id, favorited, attachments, created_at, updated_at"

/** Colunas de `task`, sem `search_vector`. */
export const TASK_COLUMNS =
  "id, owner_id, title, notes, category, status, priority, due_at, completed_at, project_id, delegated_to, important, recurrence, tags, linked_note_id, energy_level, created_at, updated_at"
