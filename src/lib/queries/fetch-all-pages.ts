// PGRST_DB_MAX_ROWS=1000 no PostgREST do VPS trunca SILENCIOSAMENTE toda
// query sem .range(). Foi esse bug que deixou /notes vazia em todos os
// devices. Volume baixo hoje não é desculpa.
const PAGE = 1000

export async function fetchAllPages<T>(
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
