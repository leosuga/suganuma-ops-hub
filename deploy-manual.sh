#!/bin/bash
# deploy-manual.sh — deploy manual no VPS (fallback quando GitHub Actions falhar)
# USO: ssh VPS_USER@VPS_HOST 'bash -s' < deploy-manual.sh

REPO="https://github.com/leosuga/suganuma-ops-hub.git"
DIR="$HOME/suganuma-ops-hub"

# Clone ou atualiza repo
if [ ! -d "$DIR" ]; then
  git clone "$REPO" "$DIR" || { echo "GIT CLONE FAILED"; exit 1; }
fi

cd "$DIR"
git fetch origin main || { echo "GIT FETCH FAILED"; exit 1; }
git reset --hard origin/main || { echo "GIT RESET FAILED"; exit 1; }

# Build e deploy via docker compose
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Build com args (necessários para next build standalone)
docker compose -f docker-compose.prod.yml build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  || { echo "BUILD FAILED"; exit 1; }

docker compose -f docker-compose.prod.yml up -d || { echo "START FAILED"; exit 1; }

# Cleanup
docker image prune -f
docker builder prune -f

# Status
docker compose -f docker-compose.prod.yml ps

# Quick health check
sleep 5
SW=$(curl -s --max-time 5 https://ops.suganuma.com.br/sw.js 2>/dev/null | head -c 30 || echo "-")
if echo "$SW" | grep -q "v4"; then
  echo "✅ Deploy manual concluído! sw.js OK"
else
  echo "⚠️ Deploy manual concluído, mas sw.js não respondeu (verificar logs)"
  docker compose -f docker-compose.prod.yml logs --tail 20
fi

echo "Health check: curl -s https://ops.suganuma.com.br/api/health"
