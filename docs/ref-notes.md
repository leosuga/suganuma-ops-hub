# Módulo Notes: estado atual e roadmap

Movido do AGENTS.md para reduzir contexto carregado por sessão. Leia sob demanda.

## Notes Module — Current State (2026-06-04)

| Aspecto | Estado |
|---|---|
| Schema | `note`: id, owner_id, title, content, tags[], pinned, linked_task_id, **para**, **daily_date**, **is_moc**, **last_review**, **project_id**, **favorited**, created_at, updated_at |
| Queries | Full CRUD TanStack Query + optimistic updates + realtime |
| Editor | Plain textarea 6 rows + react-markdown render (lazy, SSR false) |
| Task integration | Bidirecional: `→TASK` button; EditTaskDialog shows linked notes |
| CommandPalette | Shows up to 3 favorited notes + up to 3 pinned notes; context groups (`ctx/work` etc.); tag search group; navigates to `/notes` |
| PARA | Categories: projects, areas, resources, archive — filterable in NotesPage |
| Frontmatter | YAML parser `src/lib/frontmatter.ts` — metadata badges in NoteRow |
| Daily Notes | `daily_date` column + `DayDetailModal` create/edit from calendar |
| Wiki Links | `[[Note]]` syntax → rendered as links + backlinks section |
| Inline Tasks | `- [ ]` detected + checkbox sync with task module |
| MOCs | `is_moc` flag — Maps of Content shown first in NotesPage |
| Tag Namespaces | Tags with `/` prefix grouped for hierarchical filtering |
| Templates | QuickAddNote with 6 templates (standard, MOC, daily, project, area, resource) |
| Review Badge | Areas with `last_review` > 30 days show ⚠ REV warning |
| **Semantic Search** | **Ollama (nomic-embed-text) + Qdrant self-hosted; Busca Semântica panel em NotesPage; embedding auto-sync on note CRUD (create/update/delete via `syncNoteEmbedding`/`deleteNoteEmbedding` server actions)** |
| **Contexts** | **6 life contexts (work, pessoal, casa, saude, estudos, financas) with color-coded pills + strip in NoteRow + filter bar in NotesPage + QuickAdd selector + edit mode toggle** |

## Notes Feature Roadmap

| Phase | Features | Complexity | Prerequisite |
|---|---|---|---|
| **1 — Foundation** ✅ | PARA categorization + Frontmatter YAML parser + Daily Notes | Low | — |
| **2 — Connectivity** ✅ | Bidirectional links `[[Note]]` + Inline tasks `- [ ]` sync | Medium | Phase 1 |
| **3 — Intelligence** ✅ | Semantic search (Ollama + Qdrant) + Embedding auto-sync on CRUD | High | Ollama + Qdrant on VPS |

### Implementation Notes
- **Frontmatter**: Parse `---\nkey: value\n---` from top of `content` column; no schema migration needed for metadata
- **PARA**: Add `para` column (ENUM) or reuse `tags` with reserved prefix `#para-projects` etc. Migration `0025_note_para.sql`
- **Daily Notes**: Query by title pattern `YYYY-MM-DD` OR add `daily_date` column; link from calendar
- **Bidirectional links**: Regex `\[\[(.*?)\]\]` in content; use `title` as temporary key (no slugs yet); backlinks via `content LIKE '%[[title]]%'`
- **Inline tasks**: Detect `- [ ]` / `- [x]` in content; sync creates/updates tasks via `linked_note_id` on task table
- **Semantic search**: Implemented with Ollama (nomic-embed-text) + Qdrant self-hosted. Embeddings auto-synced via `syncNoteEmbedding`/`deleteNoteEmbedding` server actions on note CRUD

