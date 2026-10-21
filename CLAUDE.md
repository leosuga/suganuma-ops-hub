@AGENTS.md

# Notas de sessão

O histórico detalhado de sessões (decisões, lições, status de deploy) fica em
`docs/session-history.md` — leia sob demanda, não é carregado automaticamente.

## Regras que valem em toda sessão
- `tsc --noEmit` roda **limpo** nesta base (0 erros, 2026-10-21). Se aparecer erro, é regressão — não baseline.
- Só UM `middleware.ts` (em `src/`), nunca raiz + `src/` ao mesmo tempo.
- Migrations rodam via SSH: `docker exec -i supabase-db psql -U supabase_admin -d postgres`.
  **Aplique a migration ANTES do deploy** que usa a coluna nova (a query quebra se a coluna faltar).
- GitHub Secrets só entram no container no próximo deploy: setar secrets ANTES do deploy.
- Toda fetch externa nova usa `fetchWithTimeout()`; toda query de tabela que cresce pagina em ranges de 1000.
- Novos Dialogs/overlays: primitivos `@base-ui/react` direto quando o layout não for o modal centralizado padrão.
- Ao criar lições novas, registrá-las em `docs/session-history.md` (não aqui) e na tabela do AGENTS.md só se forem estruturais.

## Regras de trabalho (aprendidas na sessão de 2026-10-21)
- **Commit antes de qualquer operação de branch.** `git reset --hard origin/main` e
  `gh pr merge --delete-branch` mexem no repositório local (checkout + apaga a branch) e
  descartam trabalho não commitado. Perdi uma leva inteira assim.
- **Cherry-pick por SHA explícito** (`git cherry-pick <sha>`); `git log -1 --format=%H <branch>`
  em branch recém-criada devolve o HEAD errado e falha em merge commit.
- **Um assunto por PR**, sempre com o gate de CI (build + node + DOM) antes do merge.
- **Provar no artefato, não no fonte**: token de cor, cascade do CSS e estado real do
  container só se provam no CSS compilado + browser + container. Ler o código-fonte mente
  (2 dos 3 achados mais graves da auditoria eram falsos).
- **Depois do deploy, confirme**: `/api/health` (traz `build` = commit no ar), container
  `Up ... (healthy)` e as tabelas novas respondendo via PostgREST.
- A suíte **DOM** (`*.test.tsx`) só roda com Docker — está no CI (step `Test (DOM)`,
  via `Dockerfile.test`). Suíte que só roda na mão quebra em silêncio.

## Onde o app está (2026-10-21)
- `main` = produção; deploys **serializados** (`concurrency: deploy-vps`) — dois deploys
  simultâneos disputam `~/ops-hub` e o container no VPS.
- Entrada do app = **Cockpit** (`/cockpit`); `/` e o `start_url` do manifest apontam para lá.
- Fila do dia = card **FOCO** no Cockpit (tier + motivo); triagem do Inbox em **FIFO**, com
  a decisão **adiar** (migration 0043); contas fixas = migration 0044 (`/finance` + push).
- `/api/health` responde `{status, db, qdrant, notesIndexed, build}`.
