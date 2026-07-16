export interface FrontmatterResult {
  metadata: Record<string, string>
  body: string
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/

export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(FRONTMATTER_REGEX)
  if (!match) {
    return { metadata: {}, body: content }
  }

  const raw = match[1]
  const metadata: Record<string, string> = {}

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const colonIndex = trimmed.indexOf(":")
    if (colonIndex === -1) continue
    const key = trimmed.slice(0, colonIndex).trim()
    const value = trimmed.slice(colonIndex + 1).trim()
    if (key) metadata[key] = value
  }

  const body = content.slice(match[0].length)
  return { metadata, body }
}

export function injectFrontmatter(content: string, metadata: Record<string, string>): string {
  const existing = parseFrontmatter(content)
  const merged = { ...existing.metadata, ...metadata }

  const lines = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)

  if (lines.length === 0) return existing.body

  const frontmatter = `---\n${lines.join("\n")}\n---\n\n`
  return frontmatter + existing.body
}
