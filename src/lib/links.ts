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

/**
 * Mapa reverso título → notas que linkam para ele, construído uma vez sobre
 * a lista inteira. Substitui o padrão anterior de cada NoteRow varrer todas
 * as notas para achar seus backlinks (O(N²) na lista inteira).
 */
export function buildBacklinksMap<T extends { id: string; content: string | null }>(
  notes: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const note of notes) {
    if (!note.content) continue
    for (const link of parseWikiLinks(note.content)) {
      const key = link.target.toLowerCase().trim()
      const existing = map.get(key)
      if (existing) existing.push(note)
      else map.set(key, [note])
    }
  }
  return map
}

export function renderWikiLinksToMarkdown(content: string): string {
  return content.replace(WIKI_LINK_REGEX, (_match, target, display) => {
    const label = display ? display.trim() : target.trim()
    return `[${label}](/notes?search=${encodeURIComponent(target.trim())})`
  })
}
