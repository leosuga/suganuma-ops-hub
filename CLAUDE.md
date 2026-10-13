@AGENTS.md

# Notas de sessão

O histórico detalhado de sessões (decisões, lições, status de deploy) fica em
`docs/session-history.md` — leia sob demanda, não é carregado automaticamente.

## Regras que valem em toda sessão
- `tsc --noEmit` nunca passa limpo: comparar contagem/arquivos com erro contra uma baseline.
- Só UM `middleware.ts` (em `src/`), nunca raiz + `src/` ao mesmo tempo.
- Migrations rodam via SSH: `docker exec -i supabase-db psql -U supabase_admin -d postgres`.
- GitHub Secrets só entram no container no próximo deploy: setar secrets ANTES do deploy.
- Toda fetch externa nova usa `fetchWithTimeout()`; toda query de tabela que cresce pagina em ranges de 1000.
- Novos Dialogs/overlays: primitivos `@base-ui/react` direto quando o layout não for o modal centralizado padrão.
- Ao criar lições novas, registrá-las em `docs/session-history.md` (não aqui) e na tabela do AGENTS.md só se forem estruturais.
