#!/bin/bash
# Backup diário do Postgres Supabase → Garage S3
# Configuração via variáveis de ambiente (coloque em /etc/environment ou ~/.bashrc do VPS):
#
#   GARAGE_ENDPOINT=https://garage.suganuma.com.br   # ou http://IP:3900
#   GARAGE_ACCESS_KEY=<access key do Garage>
#   GARAGE_SECRET_KEY=<secret key do Garage>
#   GARAGE_BUCKET=ops-hub-backups                    # criar o bucket antes
#
# Instalar rclone no VPS: curl https://rclone.org/install.sh | bash
# Configurar: executar este script uma vez com SETUP=1 para criar o rclone.conf
# Cron diário (crontab -e): 0 3 * * * /root/scripts/backup-db.sh >> /var/log/ops-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/ops-hub"
RETENTION_DAYS=3        # dias de retenção local
REMOTE_RETENTION=14     # dias de retenção no S3
DATE=$(date +%F)
FILE="ops-db-${DATE}.pgdump"

# ── Setup do rclone (executar uma vez) ──────────────────────
if [ "${SETUP:-}" = "1" ]; then
  mkdir -p ~/.config/rclone
  cat > ~/.config/rclone/rclone.conf << EOF
[garage]
type = s3
provider = Other
access_key_id = ${GARAGE_ACCESS_KEY}
secret_access_key = ${GARAGE_SECRET_KEY}
endpoint = ${GARAGE_ENDPOINT}
force_path_style = true
EOF
  echo "rclone configurado. Criando bucket..."
  rclone mkdir "garage:${GARAGE_BUCKET:-ops-hub-backups}"
  echo "Bucket pronto. Rode sem SETUP=1 para fazer backup."
  exit 0
fi

# ── Backup ──────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Iniciando pg_dump..."
docker exec supabase-db pg_dump \
  -U postgres \
  --format=custom \
  --no-password \
  postgres > "${BACKUP_DIR}/${FILE}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILE}" | cut -f1)
echo "[$(date -Iseconds)] Dump concluído: ${FILE} (${SIZE})"

# ── Upload para Garage S3 ────────────────────────────────────
BUCKET="${GARAGE_BUCKET:-ops-hub-backups}"

echo "[$(date -Iseconds)] Enviando para garage:${BUCKET}..."
rclone copy "${BACKUP_DIR}/${FILE}" "garage:${BUCKET}/postgres/"
echo "[$(date -Iseconds)] Upload concluído."

# ── Limpeza local (>RETENTION_DAYS) ─────────────────────────
find "$BACKUP_DIR" -name "ops-db-*.pgdump" -mtime "+${RETENTION_DAYS}" -delete
echo "[$(date -Iseconds)] Limpeza local: mantendo últimos ${RETENTION_DAYS} dias."

# ── Limpeza remota (>REMOTE_RETENTION dias) ─────────────────
CUTOFF=$(date -d "-${REMOTE_RETENTION} days" +%F 2>/dev/null || \
         date -v "-${REMOTE_RETENTION}d" +%F)

rclone ls "garage:${BUCKET}/postgres/" | while read -r _ name; do
  filedate=$(echo "$name" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  if [ -n "$filedate" ] && [ "$filedate" \< "$CUTOFF" ]; then
    rclone deletefile "garage:${BUCKET}/postgres/${name}"
    echo "[$(date -Iseconds)] Removido do S3: ${name}"
  fi
done

echo "[$(date -Iseconds)] Backup finalizado com sucesso."
