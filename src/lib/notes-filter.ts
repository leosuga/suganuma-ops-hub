// Filtro das Notas — lógica pura (o componente só aplica). Fora do componente
// de propósito: dá para testar em node, sem DOM.
//
// Regras:
//   tag     → a nota tem a tag exata
//   prefix  → a nota tem alguma tag do grupo. O grupo "#" reúne as tags SEM
//             barra ("geral"); os demais são prefixos reais ("ctx/", "projeto/")
//   ctx     → a nota tem a tag de contexto (`ctx/<contexto>`)
//   para    → a nota está na área do PARA
//   search  → casa título, conteúdo OU tags (case-insensitive)

export interface FilterableNote {
  title: string
  content?: string | null
  tags?: string[] | null
  para?: string | null
}

export interface NoteFilters {
  tag?: string | null
  prefix?: string | null
  ctx?: string | null
  para?: string | null
  search?: string | null
}

export function matchesNoteFilters(note: FilterableNote, f: NoteFilters): boolean {
  if (f.tag && !note.tags?.includes(f.tag)) return false

  if (f.prefix) {
    // O prefixo no app é a parte ANTES da barra ("ctx", "projeto"); o grupo
    // "#" reúne as tags sem barra. Tolerante a barra final, para uma URL
    // escrita à mão (?prefix=ctx/) funcionar igual.
    const p = f.prefix.endsWith("/") ? f.prefix.slice(0, -1) : f.prefix
    // O matcher antigo procurava `${prefix}/` — para o grupo "#" isso é "#/",
    // que nenhuma tag tem (as tags desse grupo não têm barra) → o filtro
    // "#geral" não encontrava NADA.
    const inPrefix =
      p === "#"
        ? note.tags?.some((t) => !t.includes("/"))
        : note.tags?.some((t) => t.startsWith(`${p}/`))
    if (!inPrefix) return false
  }

  if (f.ctx && !note.tags?.some((t) => t === `ctx/${f.ctx}`)) return false

  if (f.para && note.para !== f.para) return false

  const q = f.search?.trim().toLowerCase()
  if (q) {
    const inTitle = note.title.toLowerCase().includes(q)
    const inContent = note.content?.toLowerCase().includes(q)
    const inTags = note.tags?.some((t) => t.toLowerCase().includes(q))
    if (!inTitle && !inContent && !inTags) return false
  }

  return true
}
