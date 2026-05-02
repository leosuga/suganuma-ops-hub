# Próximos passos — Suganuma Ops Hub

## Contexto
Fase 1 (Auth + Task Engine) está completa e deployada em `ops.suganuma.com.br`. Migrations `0002_finance.sql` e `0003_health.sql` já existem no repo mas ainda não foram aplicadas no Supabase self-hosted. Páginas `finance/` e `health/` são placeholders. Objetivo: avançar para **Fase 2 (Finance Hub)** como próximo bloco, mantendo Fase 3 (Health) e Fase 4 (Dashboard consolidado) em sequência.

## Plano recomendado — Fase 2: Finance Hub

### 1. Infra de dados
- Aplicar `supabase/migrations/0002_finance.sql` via Supabase Studio (`studio.suganuma.com.br`) — cria `account`, `transaction`, `csv_import` + enum `txn_kind` + RLS por `owner_id`.
- Validar tabelas e policies antes de codar.

### 2. Dependências
- `npm install papaparse @types/papaparse recharts` no `suganuma-ops-hub/`.

### 3. Schemas & Queries
- `src/lib/schemas/finance.ts` — Zod 4 schemas (`Account`, `Transaction`, `TransactionKind = income|expense|transfer`).
- `src/lib/queries/finance.ts` — hooks TanStack:
  - `useAccounts()`, `useCreateAccount()`
  - `useTransactions(filters)`, `useCreateTransaction()`, `useUpdateTransaction()`, `useDeleteTransaction()` (optimistic, padrão igual `queries/tasks.ts`)
  - `useImportCSV()` — parse via papaparse + insert em batch, registra em `csv_import`.

### 4. Componentes
- `src/components/finance/FinanceKPIs.tsx` — receita/despesa/saldo/net do mês (estilo dos KPIs do dashboard).
- `src/components/finance/TransactionTable.tsx` — lista densa (padrão `TaskRow`), filtro por conta/tipo/mês.
- `src/components/finance/AddTransactionDialog.tsx` — `@base-ui/react/dialog`, campos: data, conta, tipo, categoria, valor, descrição.
- `src/components/finance/CSVImportDialog.tsx` — upload, preview, mapeamento de colunas, commit.
- `src/components/finance/RevenueChart.tsx` — `recharts` bar/line do mês (usar tokens `--color-teal`, `--color-danger`).

### 5. Página
- Expandir `src/app/(app)/finance/page.tsx`: KPIs no topo, chart, tabela + botões "Nova transação" e "Importar CSV".

### 6. Verificação end-to-end
- `npm run build` local → sem erros de tipo.
- Deploy via `curl` na API Coolify; após deploy rodar `~/update-ops-proxy.sh` no VPS (`ssh LeoVM`).
- Teste manual em `ops.suganuma.com.br/finance`:
  - Criar conta
  - Adicionar transação manual → aparece na tabela e KPIs
  - Importar CSV (amostra Nubank) → registros batch, `csv_import` preenchido
  - Chart renderiza com dados reais

## Arquivos críticos a criar/modificar
- `src/lib/schemas/finance.ts` (novo)
- `src/lib/queries/finance.ts` (novo — reutilizar padrão de `src/lib/queries/tasks.ts`)
- `src/components/finance/*` (5 componentes novos)
- `src/app/(app)/finance/page.tsx` (expandir)
- `package.json` (deps)

## Reuso de padrões existentes
- Mutation type trick (`& { campo_db?: tipo }`) — ver `src/lib/queries/tasks.ts:63`
- Dialog `@base-ui/react` + `cn()` — ver `src/components/tasks/QuickAddDialog.tsx`
- KPI cards layout — ver `src/app/(app)/dashboard/page.tsx`
- Row denso h-10 com tokens CSS — ver `src/components/tasks/TaskRow.tsx`

## Próximas fases (depois da 2)
- **Fase 3 — Health Hub**: aplicar `0003_health.sql`; construir pregnancy tracker, biometrics log, daily protocols, appointments (usar `date-fns` já instalado).
- **Fase 4 — Dashboard consolidado**: agregados cross-domain (tasks urgentes + saldo mês + próximos appointments + biometria hoje).
- **Polish**: realtime via Supabase subscriptions, PWA manifest, a11y audit.
