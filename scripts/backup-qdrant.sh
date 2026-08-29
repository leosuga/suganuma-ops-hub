#!/bin/bash
# Backup diário do Qdrant (coleção ops_hub_notes) → Garage S3
# Mesmo padrão do backup-db.sh: snapshot HTTP → tar → rclone → S3 com retenção.
#
# Cron sugerido (crontab -e), 20 min depois do backup do Postgres:
#   20 3 * * * /home/ubuntu/scripts/backup-qdrant.sh >> /home/ubuntu/qdrant-backup.log 2>&1
#
# Env: mesmas GARAGE_* do backup-db.sh (o cron já exporta).

set -euo pipefail

SNAPSHOT_DIR="/home/ubuntu/qdrant/snapshots"     # volume montado em /qdrant/snapshots
BACKUP_DIR="/var/backups/ops-hub-qdrant"
RETENTION_DAYS=3
REMOTE_RETENTION=14
DATE=$(date +%F)

QDRANT_API_KEY=$(docker exec qdrant sh -c 'echo $QDRANT__SERVICE__API_KEY')
# A porta 6333 NÃO está publicada no host — usar o IP interno do container
# (rede dedicada do Qdrant; IP dinâmico, descoberto a cada execução)
QDRANT_HOST_IP=$(docker inspect qdrant --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' | tr ' ' '\n' | head -1)
QDRANT_URL="http://${QDRANT_HOST_IP}:6333"
FILE="ops-qdrant-${DATE}.snapshot"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Iniciando snapshot do Qdrant (${QDRANT_URL})..."
HTTP=$(curl -s -o /tmp/qdrant-snapshot.json -w "%{http_code}" \
  -X POST "${QDRANT_URL}/collections/ops_hub_notes/snapshots?wait=true" \
  -H "api-key: $QDRANT_API_KEY")
if [ "$HTTP" != "200" ]; then
  echo "ERRO: snapshot API retornou $HTTP: $(cat /tmp/qdrant-snapshot.json | head -c 200)"
  exit 1
fi
SNAP_NAME=$(python3 -c "import json; print(json.load(open('/tmp/qdrant-snapshot.json'))['result']['name'])")
echo "Snapshot criado: $SNAP_NAME"

# O snapshot fica em /qdrant/snapshots/<collection>/<name>.snapshot (root-owned)
# — localizar e copiar com sudo (mv entre usuários falha)
SNAP_PATH=$(find /home/ubuntu/qdrant/snapshots -name "${SNAP_NAME}" | head -1)
if [ -z "$SNAP_PATH" ]; then
  echo "ERRO: snapshot não encontrado em $SNAPSHOT_DIR"
  exit 1
fi
sudo -n cp "${SNAP_PATH}" "${BACKUP_DIR}/${FILE}"
sudo -n chown ubuntu:ubuntu "${BACKUP_DIR}/${FILE}"
# remove o snapshot no volume (senão acumula também lá)
sudo -n rm -f "${SNAP_PATH}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILE}" | cut -f1)
echo "[$(date -Iseconds)] Snapshot salvo localmente: ${FILE} (${SIZE})"

# Upload para o Garage S3
if [ -f ~/.config/rclone/rclone.conf ]; then
  rclone copy "${BACKUP_DIR}/${FILE}" "garage:${GARAGE_BUCKET:-backups}/qdrant/" >> /dev/null
  echo "[$(date -Iseconds)] Enviado ao S3 (bucket ${GARAGE_BUCKET:-backups}/qdrant/)"
  # retenção remota: deleta snapshots com data no nome > REMOTE_RETENTION dias
  CUTOFF=$(date -d "-${REMOTE_RETENTION} days" +%F)
  rclone lsf "garage:${GARAGE_BUCKET:-backups}/qdrant/" 2>/dev/null | while read -r f; do
    f=$(echo "$f" | tr -d '\r\n')
    [ -z "$f" ] && continue
    D=$(echo "$f" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}')
    if [ -n "$D" ] && [ "$D" \< "$CUTOFF" ]; then
      rclone deletefile "garage:${GARAGE_BUCKET:-backups}/qdrant/$f" >> /dev/null \
        && echo "Removido do S3 (>${REMOTE_RETENTION}d): $f"
    fi
  done || true
else
  echo "WARN: rclone.conf ausente — backup apenas local"
fi

# retenção local
find "${BACKUP_DIR}" -name "ops-qdrant-*.snapshot" -mtime +${RETENTION_DAYS} -delete
echo "[$(date -Iseconds)] Backup Qdrant finalizado."