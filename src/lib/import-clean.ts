/**
 * Tabelas cujo `id` é preservado no import, em vez de stripado.
 *
 * Motivo: as FKs do módulo people são INTRA-módulo (person_relation e
 * person_conflict apontam para person; guest_invite aponta para os dois).
 * O tratamento padrão — stripar id e zerar FK — devolveria pessoas soltas,
 * zero relações e zero conflitos num restore, perdendo em silêncio o único
 * dado do app que não se reconstrói de memória.
 *
 * É seguro porque o app é single-user: o caso de uso real do import é
 * restaurar o próprio backup, não migrar dados entre usuários.
 */
export const PRESERVE_ID_TABLES: ReadonlySet<string> = new Set([
  "person",
  "person_relation",
  "person_conflict",
  "guest_event",
  "guest_invite",
])

export function cleanRowsForImport(
  table: string,
  rows: Record<string, unknown>[],
  ownerId: string,
  fksToStrip: string[],
): Record<string, unknown>[] {
  const preserveId = PRESERVE_ID_TABLES.has(table)

  return rows.map((row) => {
    const { id, created_at: _c, updated_at: _u, ...rest } = row
    for (const fk of fksToStrip) {
      if (fk in rest) rest[fk] = null
    }
    const base = { ...rest, owner_id: ownerId }
    return preserveId && id !== undefined ? { ...base, id } : base
  })
}
