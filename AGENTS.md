<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack — versões exatas (não assuma defaults de treino)
- Next.js **16.2.4** | React **19.2.4** | Zod **4.3.6** | Tailwind **v4**
- UI primitives: `@base-ui/react` (Dialog, Checkbox, Button) — **NÃO é Radix UI**
- Tokens CSS: `--color-bg`, `--color-teal`, `--color-surface`, etc. via `@theme inline` no globals.css

## Regras de código
- Sempre usar `cn()` de `@/lib/utils` para classes condicionais
- Dialog: `open` (boolean) + `onOpenChange={(v) => setState(v)}`
- Checkbox: prop `checked` (boolean) + `onCheckedChange`
- Campos de DB (`owner_id`, `completed_at`, `created_at`) NÃO estão no Zod schema — adicionar no tipo da mutation quando necessário
- Server components podem usar `createClient()` de `@/lib/supabase/server` (async)
- Client components usam `createClient()` de `@/lib/supabase/client` (sync)

## Deploy
- Coolify UUID: `sw2ag8vuujt87zk04wwbxsvg`
- Após redeploy, rodar `~/update-ops-proxy.sh` no VPS (IP do container muda)
- Trigger manual: `curl -X POST -H "Authorization: Bearer bMysjio7FivWUXi945RelAKz5aCQXFVcGMuApGiHcb25e2de" https://coolify.suganuma.com.br/api/v1/applications/sw2ag8vuujt87zk04wwbxsvg/start`
