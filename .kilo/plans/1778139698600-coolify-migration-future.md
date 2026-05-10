# Migração Futura: Caddy → Traefik (Coolify Deploy)

> Status: **CONGELADO** — não executar sem autorização explícita
> Data de criação: 2026-05-10
> Criado por: investigação completa do VPS + Coolify

---

## Contexto

O Coolify está instalado e funcional no VPS, mas **não pode gerenciar deploys** porque o proxy padrão dele (Traefik) conflita com o Caddy existente que serve todos os domínios do VPS. Este plano documenta os passos para **substituir o Caddy pelo Traefik do Coolify**, habilitando assim deploy via Coolify UI/API com rollback, env vars, e logs centralizados.

---

## Pré-requisitos antes de iniciar

- [ ] Janela de manutenção de **pelo menos 2 horas**
- [ ] Acesso SSH ao VPS (`ubuntu@144.22.194.71`)
- [ ] Backup manual do Caddyfile atual (`~/proxy/Caddyfile`)
- [ ] Todos os domínios mapeados e funcionando (verificação prévia)
- [ ] DNS apontando para o VPS IP (já está)
- [ ] Decisão: manter Let's Encrypt (Traefik gerencia automaticamente) ou usar certificados próprios

---

## Passo a passo da migração

### 1. Documentar configuração atual do Caddy

Coletar todos os blocos do Caddyfile para conversão:

```bash
# Rodar no VPS
docker exec caddy_proxy cat /etc/caddy/Caddyfile > ~/caddyfile-backup-$(date +%Y%m%d).txt
```

Blocos a migrar:
- `suganuma.com.br, wp.suganuma.com.br` → reverse_proxy `litespeed:80`
- `ols.suganuma.com.br` → reverse_proxy `litespeed:7080` (TLS skip)
- `n8n.suganuma.com.br` → reverse_proxy `n8n_app:5678`
- `studio.suganuma.com.br` → reverse_proxy `supabase_studio:3000` + basic_auth
- `api.suganuma.com.br` → reverse_proxy `supabase_kong:8000`
- `s3.suganuma.com.br` + `*.s3.suganuma.com.br` → reverse_proxy `100.102.41.100:3900`
- `qdrant.suganuma.com.br` → reverse_proxy `qdrant:6333`
- `qdrant-grpc.suganuma.com.br` → reverse_proxy `qdrant:6334` (h2c)
- `auth.suganuma.com.br` → reverse_proxy `100.102.41.100:9000`
- `coolify.suganuma.com.br` → reverse_proxy `coolify:8080` + soketi `/app/*`
- `nextcloud.suga.com.br` → reverse_proxy `100.102.41.100` (TLS skip)
- `immich.suga.com.br` → reverse_proxy `100.102.41.100` (TLS skip)
- `webui.suga.com.br` → reverse_proxy `100.102.41.100` (TLS skip)
- `ops.suganuma.com.br` → reverse_proxy `suganuma-ops-hub:3000`

### 2. Configurar Coolify para usar Traefik

Atualmente o proxy do servidor está como `"NONE"` (forçado via SQL). Para reativar:

```bash
# Via Coolify API ou UI
# 1. Ir em Server → Proxy
# 2. Selecionar "Traefik" como proxy type
# 3. Salvar (Coolify cria container coolify-proxy automaticamente)
#
# OU via SQL no banco do Coolify (se necessário):
docker exec coolify-db psql -U coolify -d coolify -c "
  UPDATE servers
  SET proxy = jsonb_set(proxy, '{type}', '\"TRAEFIK\"')::jsonb,
      updated_at = NOW()
  WHERE uuid = 'vpqzuhhaptcp8dpnl2y0y478';
"
```

**⚠️ Atenção**: Isso vai tentar subir Traefik nas portas 80/443. Precisa **primeiro** parar o Caddy:

```bash
# ANTES de ativar Traefik no Coolify:
docker stop caddy_proxy
docker rm caddy_proxy
```

### 3. Migrar cada serviço para labels Traefik

Cada container que hoje é proxyado pelo Caddy precisa de **labels Docker** para o Traefik rotear:

**Exemplo: n8n_app**

```yaml
# Adicionar ao container n8n_app (via docker run --label ou docker-compose)
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.n8n.rule=Host(\`n8n.suganuma.com.br\`)"
  - "traefik.http.routers.n8n.entrypoints=http,https"
  - "traefik.http.services.n8n.loadbalancer.server.port=5678"
```

**Para containers Tailscale (TrueNAS via 100.102.41.100)**:

Traefik não consegue rotear diretamente para IPs externos. Soluções:
- Opção A: Criar containers "dummy" no Docker que fazem `socat`/`nginx` para o IP Tailscale
- Opção B: Manter uma instância Nginx mínima como bridge
- Opção C: Usar `file provider` do Traefik para IPs externos (mais limpo)

**Exemplo com file provider (Traefik dynamic config)**:

```yaml
# /data/coolify/proxy/dynamic/tailscale-services.yml
http:
  routers:
    nextcloud:
      rule: "Host(\`nextcloud.suga.com.br\`)"
      service: nextcloud
      entryPoints:
        - https
  services:
    nextcloud:
      loadBalancer:
        servers:
          - url: "https://100.102.41.100"
```

### 4. Serviços especiais

**Supabase Studio (basic_auth)**:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.studio.rule=Host(\`studio.suganuma.com.br\`)"
  - "traefik.http.routers.studio.middlewares=studio-auth"
  - "traefik.http.middlewares.studio-auth.basicauth.users=admin:$$apr1$$H6uskkkW$$IgXLP6ewTrSuBkTrqE8wj/"
```

**Qdrant gRPC (h2c)**:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.qdrant-grpc.rule=Host(\`qdrant-grpc.suganuma.com.br\`)"
  - "traefik.http.services.qdrant-grpc.loadbalancer.server.port=6334"
  - "traefik.http.services.qdrant-grpc.loadbalancer.server.scheme=h2c"
```

**Coolify Soketi (WebSocket)**:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.coolify.rule=Host(\`coolify.suganuma.com.br\`)"
  - "traefik.http.routers.coolify.service=coolify"
  - "traefik.http.routers.coolify-ws.rule=Host(\`coolify.suganuma.com.br\`) && PathPrefix(\`/app/\`)"
  - "traefik.http.routers.coolify-ws.service=coolify-ws"
  - "traefik.http.services.coolify.loadbalancer.server.port=8080"
  - "traefik.http.services.coolify-ws.loadbalancer.server.port=6001"
```

### 5. Configurar app no Coolify

Depois que Traefik está rodando e rotear tráfego:

1. Acessar `coolify.suganuma.com.br`
2. Ir no projeto `Ops Hub` → environment `production`
3. Editar app `suganuma-ops-hub`:
   - **Domains**: `ops.suganuma.com.br`
   - **Build Pack**: `dockerfile`
   - **Ports**: `3000`
   - **Environment Variables**: adicionar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SECRET`
   - **Build Arguments**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Salvar e fazer deploy

O Coolify automaticamente adiciona labels Traefik ao container:
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.ops-hub.rule=Host(\`ops.suganuma.com.br\`)"
  - "traefik.http.services.ops-hub.loadbalancer.server.port=3000"
```

### 6. Testar e validar

Após cada serviço migrado:

```bash
# Testar domínio
curl -I https://ops.suganuma.com.br
curl -I https://n8n.suganuma.com.br
curl -I https://api.suganuma.com.br

# Verificar Traefik dashboard (se habilitado)
# Acessar http://VPS_IP:8080/dashboard/ (proteger com basic auth em produção)
```

### 7. Rollback (se necessário)

Se algo quebrar:

```bash
# Parar Traefik
docker stop coolify-proxy
docker rm coolify-proxy

# Restaurar Caddy
docker run -d --name caddy_proxy --restart unless-stopped \
  -v ~/proxy/Caddyfile:/etc/caddy/Caddyfile \
  -v ~/proxy/data:/data \
  -v ~/proxy/config:/config \
  -p 80:80 -p 443:443 -p 443:443/udp \
  --network coolify \
  caddy:2-alpine
```

---

## Riscos identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Traefik não consegue rotear para Tailscale IPs | Alta | Alto | Usar file provider ou container bridge Nginx |
| Certificados SSL expiram durante migração | Baixa | Alto | Traefik gerencia Let's Encrypt automaticamente |
| Container renomeado pelo Coolify quebra Caddy | Média | Médio | Usar `--hostname` ou labels consistentes |
| Coolify proxy falha ao iniciar (portas ocupadas) | Baixa | Alto | Parar Caddy ANTES de ativar Traefik |
| Perda de config Caddyfile | Baixa | Alto | Backup em `~/caddyfile-backup-YYYYMMDD.txt` |
| Supabase Kong precisa de headers específicos | Média | Médio | Testar API após migração |

---

## Decisões a tomar antes da migração

1. **Tailscale services**: manter Caddy como bridge para TrueNAS/Tailscale, ou criar solução pure-Traefik?
2. **Dashboard Traefik**: habilitar dashboard em `traefik.suganuma.com.br`? (requer basic auth)
3. **Rate limiting**: Traefik suporta rate limiting nativo — habilitar?
4. **Observabilidade**: Traefik exporta métricas Prometheus — configurar?

---

## Checklist de validação pós-migração

- [ ] `ops.suganuma.com.br` carrega corretamente
- [ ] `api.suganuma.com.br` responde 200
- [ ] `n8n.suganuma.com.br` funcional
- [ ] `studio.suganuma.com.br` com basic auth
- [ ] `coolify.suganuma.com.br` acessível (Soketi WS funcional)
- [ ] `s3.suganuma.com.br` acessível
- [ ] `nextcloud.suga.com.br`, `immich.suga.com.br`, `webui.suga.com.br` via Tailscale
- [ ] SSL válido em todos os domínios (Let's Encrypt)
- [ ] Deploy via Coolify UI funciona (push → build → deploy)
- [ ] Rollback via Coolify funciona (redeploy previous version)
- [ ] GitHub Actions atualizado para usar API Coolify (opcional)

---

## Referências

- [Coolify Proxy Docs](https://coolify.io/docs/knowledge-base/proxy/traefik/overview)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Traefik File Provider](https://doc.traefik.io/traefik/providers/file/)
- Caddyfile atual backup: `~/proxy/Caddyfile`
- VPS: `144.22.194.71` (oracle-cloud)
- Coolify API Token: `8|...` (SHA-256 hash no DB)
- Coolify App UUID: `jgm57p9ild1iiriynleuatcz`
