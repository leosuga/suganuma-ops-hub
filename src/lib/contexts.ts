// Life contexts for notes — orthogonal to PARA
// Tags use prefix `ctx/` (e.g., "ctx/work", "ctx/casa")

export const CONTEXT_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; strip: string }
> = {
  work:      { label: "W▲RK",     color: "text-blue-400",      bg: "bg-blue-400/10",      border: "border-blue-400/40",      strip: "border-l-blue-400" },
  pessoal:   { label: "PESSOAL",  color: "text-green-400",     bg: "bg-green-400/10",     border: "border-green-400/40",     strip: "border-l-green-400" },
  casa:      { label: "CASA",     color: "text-orange-400",    bg: "bg-orange-400/10",    border: "border-orange-400/40",    strip: "border-l-orange-400" },
  saude:     { label: "SAÚDE",    color: "text-red-400",       bg: "bg-red-400/10",       border: "border-red-400/40",       strip: "border-l-red-400" },
  estudos:   { label: "ESTUDOS",  color: "text-purple-400",    bg: "bg-purple-400/10",    border: "border-purple-400/40",    strip: "border-l-purple-400" },
  financas:  { label: "FINANÇAS", color: "text-amber-400",     bg: "bg-amber-400/10",     border: "border-amber-400/40",     strip: "border-l-amber-400" },
}

export function parseContextTags(tags: string[] | null): string[] {
  if (!tags) return []
  return tags.filter((t) => t.startsWith("ctx/")).map((t) => t.slice(4))
}

export function getContextKey(tag: string): string | null {
  if (tag.startsWith("ctx/")) return tag.slice(4)
  if (CONTEXT_CONFIG[tag]) return tag
  return null
}

export function addContextTag(tags: string[] | null, context: string): string[] {
  const base = tags ?? []
  const tag = `ctx/${context}`
  if (base.includes(tag)) return base
  // Remove any other ctx/ tags (single-context for now) if you want multi, just remove this line
  // For multi-context support, keep this commented:
  // return [...base, tag]
  const filtered = base.filter((t) => !t.startsWith("ctx/"))
  return [...filtered, tag]
}

export function removeContextTag(tags: string[] | null, context: string): string[] {
  const tag = `ctx/${context}`
  return (tags ?? []).filter((t) => t !== tag)
}
