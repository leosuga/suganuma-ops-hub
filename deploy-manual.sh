#!/bin/bash
# deploy-manual.sh — rode no VPS quando o GitHub Actions falhar
set -e

REPO="https://github.com/leosuga/suganuma-ops-hub.git"
DIR="~/suganuma-ops-hub"

# Clone ou atualiza repo
if [ ! -d "$DIR" ]; then
  git clone "$REPO" "$DIR"
fi

cd "$DIR"
git fetch origin main
git reset --hard origin/main

# Build e deploy
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build

# Cleanup
docker image prune -f
docker builder prune -f

# Status
docker compose -f docker-compose.prod.yml ps

echo "✅ Deploy manual concluído!"
echo "Health check: curl -s https://ops.suganuma.com.br/api/health"
