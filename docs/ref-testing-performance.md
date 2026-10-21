# Testes (Vitest) e Performance

Movido do AGENTS.md para reduzir contexto carregado por sessão. Leia sob demanda.

## Testes — Vitest

### Configuração
- Framework: **Vitest 4.1.5**
- Config padrão: `vitest.config.ts` — ambiente `node`, pool `forks`, `singleFork: true`
  - Necessário porque `jsdom`/`happy-dom` travam no Node.js **v25.6.0** local
  - Testes unitários puros (schemas, parsers, contexts) rodam em milissegundos
  - **Exclui `tests/queries/*.test.tsx` via `exclude`** (2026-08-29): DOM tests não pertencem ao node env; antes eram coletados e falhavam com `ReferenceError: document` como "44 falhas" fictícias
- Config DOM: `vitest.dom.config.ts` — ambiente `happy-dom` para testes de componente React
  - Só funciona dentro do container Docker (`node:22-alpine`); localmente trava no Node v25
- Comando: `npm test` → `vitest --no-watch` (só testes node)
- Comando: `npm run test:docker` → builda imagem Docker e roda **todos** os testes com happy-dom

### Testes atuais (2026-08-29)
| Suite | Arquivo | Testes |
|---|---|---|
| Zod schemas | `tests/schemas.test.ts` | 38 |
| OAuth (puro, sem mocks) | `tests/oauth.test.ts` | 15 |
| Webhook HMAC/ID | `tests/webhooks-hmac.test.ts` | 16 |
| Task parser | `src/lib/parse-title.test.ts` | 12 |
| Context tags | `src/lib/contexts.test.ts` | 12 |
| Queries React (DOM) | `tests/queries/*.test.tsx` | 45 |
| Smoke | `tests/queries/smoke.test.ts` | 1 |
| **Total** | | **139** (94 node + 45 DOM) |

> ⚠️ Testes DOM/componentes (`.test.tsx`) travam no Node v25 local. Usar `npm run test:docker` (node:22-alpine). Testes node (`npm test`) funcionam localmente — agora sem falsas falhas.

### Gate de testes no deploy (2026-08-29)
- `deploy.yml` roda `npm ci` + `npx vitest run` **antes** do SSH no VPS — build não sobe com testes vermelhos
- O gate bloqueou 2 deploys na primeira ativação (vitest órfão sem `npm ci`; DOM tests no node env) — provou valor imediatamente
- Rollback de deploy: imagem é taggeada por `GIT_SHA` (`ops-hub:<sha>`) além de `latest` — rollback = `docker run ops-hub:<sha-anterior>`

### Execução
```bash
# Testes unitários locais (Node env)
npm test

# Todos os testes, incluindo componentes React (requer Docker)
npm run test:docker
```

### Boas práticas
- Mocks Supabase: `vi.mock("@/lib/supabase/client")` + função `chain()` fluente
- Mocks Realtime: `vi.mock("@/lib/realtime")` → `useRealtimeTable` no-op
- Não adicionar `jsdom` de volta sem testar no Node v25; `happy-dom` + Docker é a alternativa estável

## Performance — regras e aprendizados (2026-05-20)

### TanStack Query — configuração ótima
- **`refetchOnWindowFocus: false`** global — o app já usa realtime WebSocket (Supabase Postgres Changes), refetch ao focar aba é redundante
- **`staleTime` por query**, não global único:
  - `Infinity`: budget (só muda via mutation explícita), pregnancy (quase estático)
  - `5 * 60_000` (5min): projects, protocols (mudam raramente)
  - `30_000` (30s): tasks, transactions (mudam com frequência, realtime já empurra updates)
  - Demais queries: usam default global `60_000` (notes, meals, habits, calendar)
- **`gcTime: 5 * 60_000`** global (5 minutos) — adequado para dados que o usuário revisita em navegação

### Code-splitting com `next/dynamic`
- **Sempre usar `dynamic(() => import(...))` com `loading:`** para componentes abaixo da dobra ou acionados por interação
- A ordem de lazy-loading aplicada:
  1. `CommandPalette` (cmdk) — já era lazy, via AppShell (mantido)
  2. `RevenueChart` (recharts) — lazy, `/finance`
  3. `CSVImportDialog` (papaparse) — lazy, `/finance`
  4. `ReactMarkdown` — lazy, `/notes`
  5. **`HealthTrends`** (recharts, WeightChart + BloodPressureChart) — lazy, `/health` — **-384 KB** na first load
  6. **`EditTaskDialog`** (407 linhas) — lazy, `/tasks` — **-15 KB**
  7. **`SelectiveImportDialog`** — lazy, `/settings` — **-74 KB**
- **Skeleton `loading:` obrigatório** — `dynamic()` sem fallback causa layout shift e UX ruim
- **Conflito de nomes**: Turbopack não permite importar `type { NoteRow }` e `{ NoteRow }` (componente) no mesmo arquivo. Renomear um deles ou remover type import se não usado
- **Componentes inline NUNCA** — definir componente dentro do mesmo arquivo da página impede tree-shaking. Extrair para `src/components/X/` sempre

### CSS e fontes
- **`--font-geist-mono`**: removido do `@theme inline` — Geist nunca foi importado, era variável morta
- **`@tailwindcss/typography`**: JIT purga classes não usadas automaticamente. CSS code-split não traz ganho real
- **Inter auto-hospedada** (`src/app/fonts/`, `next/font/local`): `next/font/google` **baixa a fonte no build** — o build virava dependente de rede (e quebrava no Mac por causa do `SSL_CERT_FILE`). Com a fonte no repo, o build é hermético e ~1,4s mais rápido. `--font-sans` usa `var(--font-inter)` — o `next/font/local` gera o nome de família `inter` (minúsculo) e o CSS não deve depender de match case-insensitive

### Dependências
- **`remark-gfm` removido** — zero imports no código, 94 pacotes a menos
- **`require("papaparse")` → `import Papa from "papaparse"`** — tree-shaking correto via ESM
- **`recharts` 3.8.1**: ~150-180 KB. Só usar onde indispensável (RevenueChart, WeightChart, BloodPressureChart). Sempre lazy-load

### Arquivos removidos
- **9 `loading.tsx` deletados** — inúteis em app 100% client-side (páginas são `"use client"`, loading.tsx depende de RSC streaming)

### Bundle atual por rota (2026-05-20, uncompressed)
| Rota | Tamanho | vs antes |
|---|---|---|
| /health | 935 KB | -29% |
| /settings | 835 KB | -10% |
| /tasks | 943 KB | -4% |
| /dashboard | 890 KB | -2% |
| /finance | 954 KB | -2% |
| /login | 743 KB | -2% |
| **/reports** | 844 KB | **agora com cache TanStack** |

### Build
- Local: ~4.5s (`SKIP_TSC=1`)
- VPS: ~60s (Docker build + push)
- **NUNCA adicionar job `typecheck`** no workflow — já removido permanentemente
- **`loading.tsx` NUNCA recriar** — o app é 100% client-side, loading.tsx não funciona sem RSC

### O que NÃO fazer
- Converter páginas para RSC — reescreveria toda arquitetura de dados (TanStack Query + Realtime são client-side)
- Substituir recharts por SVG nativo — 4+ gráficos, horas de trabalho, risco de bugs
- CSS code-split — Tailwind JIT já purga classes não usadas, ganho marginal
- Build cache no Docker — setup atual (`rm -rf` + `git clone`) não aproveita, complexidade não vale

