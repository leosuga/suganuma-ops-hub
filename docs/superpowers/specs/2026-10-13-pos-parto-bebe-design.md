# Pós-parto — módulo Bebê, push antecipado e orçamento por categoria

**Data:** 2026-10-13
**Status:** implementado (migrations 0041 e 0042 pendentes de aplicação no VPS)

## 1. Problema

A filha nasceu em 06/10/2026. O Ops Hub só tinha o modo gravidez (`PregnancyCard`, "Semana de
gestação" no Dashboard, template de enxoval). Não havia registro da rotina da bebê, cronograma de
vacinas/consultas/triagens, prazos de documentos, cuidados da mãe nem gasto por categoria.

## 2. Decisões

| Tema | Decisão | Por quê |
|---|---|---|
| Escopo | Agenda + rotina diária (mamada, fralda, sono, remédio) | Substitui um app dedicado; o Claude registra via MCP |
| Vacinas | Calendário particular SBIm 2026-27 | Escolha da família; as versões do calendário divergem, então o seed é revisável |
| Cronograma | **Tasks comuns** num projeto "Bebê — nome" | Herda Cockpit, Calendário, push, MCP e recorrência sem código novo |
| Acesso | Só o dono registra | Conta da mãe exigiria household no RLS: projeto à parte |
| Navegação | BEBÊ substitui INBX na BottomNav | A bebê é o uso mais frequente nesta fase; o Inbox vai para o HUB |

## 3. Modelo de dados

- `child` — nome, `birth_at`, medidas de nascimento, `project_id` (projeto do cronograma), `pregnancy_id`.
- `baby_log` — `kind` ∈ feed, diaper, sleep, med, growth, temp, note; `started_at`/`ended_at`; `data jsonb`
  validado por união discriminada em Zod (`src/lib/schemas/baby.ts`).
- `budget_category` — meta mensal por categoria; unicidade por `category_key` normalizada.

## 4. Estrutura

Lógica pura em `src/lib/baby/` (testável em node, já que testes de DOM só rodam em Docker):
`dates`, `summary`, `quick-log`, `care-schedule`, `agent`; `server.ts` só para rotas de agente.
UI em `src/components/baby/`, página `/baby`. Agente: `/api/agent/baby` e `/logs`, tools MCP
`baby_summary`, `baby_log_event`, `baby_list_logs`. O `child_id` é sempre o do dono do token.

## 5. Fora do escopo

Conta própria da mãe / household no RLS; curva de crescimento OMS com percentis; timer de mamada;
push de "hora de mamar"; contas a pagar recorrentes; `auth.getUser()` dentro das queryFns (backlog 4).

## 6. Riscos

- **Conteúdo clínico** (vacinas, sinais de alerta) é orientação geral, não prescrição: a UI e as notas
  das tasks mandam confirmar com o pediatra, e o diálogo mostra tudo antes de criar.
- **Restore** zera `child.project_id`; o botão de gerar cronograma reaparece e não deve ser usado se
  as tasks já existirem.
- Prazos legais citados no seed (certidão em 15 dias, plano de saúde em 30 dias sem carência) devem
  ser conferidos na operadora e no cartório.
