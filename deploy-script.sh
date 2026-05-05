#!/bin/bash
# deploy-script.sh — executado no VPS para configurar Coolify e fazer deploy
set -e

TOKEN="${COOLIFY_TOKEN}"
BASE="http://localhost:8081/api/v1"
SERVER="vpqzuhhaptcp8dpnl2y0y478"
KEYFILE="/tmp/coolify_local_key"

echo "========================================="
echo "=== CONFIGURANDO COOLIFY + DEPLOY    ==="
echo "========================================="

# 1. Gerar chave SSH para o Coolify usar com localhost
echo ""
echo "=== 1. Gerando par de chaves SSH ==="
if [ -f "$KEYFILE" ]; then
  echo "Chave ja existe, reutilizando"
else
  ssh-keygen -t ed25519 -f "$KEYFILE" -N "" -C "coolify-localhost" -q
  echo "Chave gerada em $KEYFILE"
fi

# 2. Autorizar para root (Coolify conecta como root no localhost)
echo ""
echo "=== 2. Autorizando chave para root ==="
sudo mkdir -p /root/.ssh
sudo chmod 700 /root/.ssh
sudo cp "${KEYFILE}.pub" /root/.ssh/authorized_keys
sudo chmod 600 /root/.ssh/authorized_keys
echo "OK: /root/.ssh/authorized_keys atualizado"

# 3. Registrar chave privada no Coolify via API
echo ""
echo "=== 3. Registrando chave no Coolify ==="
python3 -c "
import json, subprocess, os

# Lê a chave privada
with open('$KEYFILE') as f:
    key_content = f.read()

# Monta payload JSON
payload = json.dumps({
    'name': 'localhost-root',
    'description': 'root@localhost ed25519',
    'private_key': key_content
})

# Escreve em arquivo para curl -d @
with open('/tmp/cf-payload.json', 'w') as f:
    f.write(payload)

# Verifica se ja existe key com esse nome
existing = subprocess.run(
    ['curl', '-sS',
     '-H', 'Authorization: Bearer ' + os.environ['COOLIFY_TOKEN'],
     'http://localhost:8081/api/v1/security/keys'],
    capture_output=True, text=True
)
try:
    keys = json.loads(existing.stdout)
    for k in keys:
        if k.get('name') == 'localhost-root':
            print('KEY_EXISTS uuid=' + k.get('uuid', '?'))
            exit(0)
except:
    pass

# Cria nova chave
resp = subprocess.run(
    ['curl', '-sS', '-X', 'POST',
     '-H', 'Authorization: Bearer ' + os.environ['COOLIFY_TOKEN'],
     '-H', 'Content-Type: application/json',
     '-d', '@/tmp/cf-payload.json',
     'http://localhost:8081/api/v1/security/keys'],
    capture_output=True, text=True
)
print(resp.stdout[:600])

data = json.loads(resp.stdout)
print('KEY_UUID=' + data.get('uuid', 'NONE'))
"

# 4. Validar servidor
echo ""
echo "=== 4. Validando servidor ==="
curl -sS -X POST -H "Authorization: Bearer $TOKEN" "$BASE/servers/$SERVER/validate" 2>&1 || true

sleep 5

echo ""
echo "=== 5. Status do servidor ==="
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/servers/$SERVER" 2>&1 | python3 -c "
import sys, json
s = json.load(sys.stdin)
print('reachable=' + str(s.get('is_reachable')))
print('usable=' + str(s.get('is_usable')))
" 2>/dev/null || echo "(status parse falhou)"

echo ""
echo "=== 6. Docker status ==="
docker info 2>&1 | head -3 || echo "(docker nao acessivel)"
