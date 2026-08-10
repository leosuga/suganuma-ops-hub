type Category = "finance" | "logistics" | "personal" | "health"
type Priority = "low" | "med" | "high" | "urgent"

interface ProjectLike {
  id: string
  name: string
}

const RESERVED_HASH = new Set(["finance", "logistics", "personal", "health"])

interface ParsedTitle {
  title: string
  category?: Category
  priority?: Priority
  due_at?: string
  project_id?: string | null
  delegated_to?: string
  important?: boolean
  recurrence?: string | null
  tags?: string[]
  energy_level?: "low" | "med" | "high"
}

export function parseTitle(raw: string, projects: ProjectLike[]): ParsedTitle {
  let title = raw.trim()
  let category: Category | undefined
  let priority: Priority | undefined
  let due_at: string | undefined
  let project_id: string | undefined | null
  let delegated_to: string | undefined
  let important: boolean | undefined
  let recurrence: string | null | undefined
  let tags: string[] | undefined
  let energy_level: "low" | "med" | "high" | undefined

  // *diario *semanal *mensal (recurrence)
  const recMatch = title.match(/\*(diari[oa]|semanal|mensal)/i)
  if (recMatch) {
    const raw = recMatch[1].toLowerCase()
    if (raw.startsWith("diari")) recurrence = "daily"
    else if (raw === "semanal") recurrence = "weekly"
    else if (raw === "mensal") recurrence = "monthly"
    title = title.replace(recMatch[0], "").trim()
  }

  // +importante
  if (title.includes("+importante")) {
    important = true
    title = title.replace("+importante", "").trim()
  }

  // @Nome (delegado para)
  const delegMatch = title.match(/@(\S+)/)
  if (delegMatch) {
    delegated_to = delegMatch[1]
    title = title.replace(delegMatch[0], "").trim()
  }

  // >Nome do Projeto — match against known projects (longest name first)
  const sorted = [...projects].sort((a, b) => b.name.length - a.name.length)
  for (const proj of sorted) {
    const escaped = proj.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`>${escaped}(?=\\s|$)`, "i")
    const match = title.match(re)
    if (match) {
      project_id = proj.id
      title = title.replace(match[0], "").trim()
      break
    }
  }

  // #finance #logistics #personal #health
  const catMatch = title.match(/#(finance|logistics|personal|health)/i)
  if (catMatch) {
    category = catMatch[1].toLowerCase() as Category
    title = title.replace(catMatch[0], "").trim()
  }

  // #tags — free-form (remaining #word patterns after categories extracted)
  const tagMatches = title.matchAll(/#(\w+)/gi)
  const collected: string[] = []
  for (const m of tagMatches) {
    const word = m[1].toLowerCase()
    if (word.length > 0) collected.push(word)
  }
  if (collected.length > 0) {
    tags = [...new Set(collected)]
    title = title.replace(/#\w+/gi, "").trim()
  }

  // !urgent !high !low
  const priMatch = title.match(/!(urgent|high|med|low)/i)
  if (priMatch) {
    priority = priMatch[1].toLowerCase() as Priority
    title = title.replace(priMatch[0], "").trim()
  }

  // ^tomorrow ^today ^YYYY-MM-DD
  const dueMatch = title.match(/\^(\S+)/)
  if (dueMatch) {
    const raw2 = dueMatch[1].toLowerCase()
    const today = new Date()
    today.setHours(23, 59, 0, 0)
    if (raw2 === "today") {
      due_at = today.toISOString()
    } else if (raw2 === "tomorrow") {
      today.setDate(today.getDate() + 1)
      due_at = today.toISOString()
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw2)) {
      due_at = new Date(raw2 + "T23:59:00").toISOString()
    }
    title = title.replace(dueMatch[0], "").trim()
  }

  // ~low ~med ~high (energy level)
  const energyMatch = title.match(/~(low|med|high)/i)
  if (energyMatch) {
    energy_level = energyMatch[1].toLowerCase() as "low" | "med" | "high"
    title = title.replace(energyMatch[0], "").trim()
  }

  return { title, category, priority, due_at, project_id, delegated_to, important, recurrence, tags, energy_level }
}
