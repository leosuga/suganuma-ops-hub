// Ordenação das tasks — lógica pura (o componente só aplica).
//
// "due" (padrão) NÃO reordena no cliente: a query já vem do servidor em
// `due_at` ASC (nulls last) + `created_at` DESC, e essa ordem (prazo, com as
// sem prazo no fim) é a que o app sempre teve.

export type TaskSort = "due" | "priority" | "important" | "created"

export interface SortableTask {
  id: string
  priority?: string | null
  important?: boolean | null
  due_at?: string | null
  created_at?: string | null
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  med: 2,
  low: 3,
}

function rank(priority?: string | null): number {
  const r = PRIORITY_RANK[priority ?? ""]
  return r === undefined ? PRIORITY_RANK.med : r
}

/** Mais cedo primeiro; sem prazo vai para o fim. */
function byDue(a: SortableTask, b: SortableTask): number {
  if (!a.due_at && !b.due_at) return 0
  if (!a.due_at) return 1
  if (!b.due_at) return -1
  return a.due_at.localeCompare(b.due_at)
}

export function sortTasks<T extends SortableTask>(tasks: T[], sort: TaskSort): T[] {
  if (sort === "due") return tasks
  const list = [...tasks]
  switch (sort) {
    case "priority":
      return list.sort((a, b) => rank(a.priority) - rank(b.priority) || byDue(a, b))
    case "important":
      return list.sort((a, b) => Number(!!b.important) - Number(!!a.important) || byDue(a, b))
    case "created":
      return list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    default:
      return list
  }
}
