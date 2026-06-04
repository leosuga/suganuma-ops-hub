export interface WikiLink {
  raw: string
  target: string
  display: string
}

const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function parseWikiLinks(content: string): WikiLink[] {
  const matches: WikiLink[] = []
  let m: RegExpExecArray | null
  while ((m = WIKI_LINK_REGEX.exec(content)) !== null) {
    matches.push({
      raw: m[0],
      target: m[1].trim(),
      display: m[2] ? m[2].trim() : m[1].trim(),
    })
  }
  return matches
}

export function renderWikiLinksToMarkdown(content: string): string {
  return content.replace(WIKI_LINK_REGEX, (_match, target, display) => {
    const label = display ? display.trim() : target.trim()
    return `[${label}](/notes?search=${encodeURIComponent(target.trim())})`
  })
}

export function findBacklinks(targetTitle: string, allNotes: { id: string; title: string; content: string | null }[]): { id: string; title: string }[] {
  const normalizedTarget = targetTitle.toLowerCase().trim()
  return allNotes
    .filter((n) => n.id !== targetTitle && (n.content?.toLowerCase().includes(`[[${normalizedTarget}]]`) || n.content?.toLowerCase().includes(`[[${normalizedTarget}|`)))
    .map((n) => ({ id: n.id, title: n.title }))
}
