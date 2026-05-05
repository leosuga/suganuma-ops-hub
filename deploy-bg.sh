#!/bin/bash
set -e
LOG=/tmp/deploy-ops-hub.log
echo "=== Deploy started at $(date) ===" > $LOG

cd ~
[ -d ops-hub ] && rm -rf ops-hub
git clone --depth 1 https://github.com/leosuga/suganuma-ops-hub.git ops-hub >> $LOG 2>&1
cd ops-hub

echo NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL > .env.prod
echo NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY >> .env.prod
echo SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY >> .env.prod
echo WEBHOOK_SECRET=$WEBHOOK_SECRET >> .env.prod

NET=$(docker inspect caddy_proxy --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys())[0])" 2>/dev/null || echo caddy_default)
echo "Network: $NET" >> $LOG

echo "Building Docker image..." >> $LOG
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t ops-hub:latest . >> $LOG 2>&1

echo "Build done. Stopping old containers..." >> $LOG
OLD=$(docker ps -q --filter name=sw2ag8vuujt87zk04wwbxsvg 2>/dev/null || echo "")
[ -n "$OLD" ] && docker stop "$OLD" >> $LOG 2>&1 && docker rm "$OLD" >> $LOG 2>&1
docker stop suganuma-ops-hub 2>/dev/null && docker rm suganuma-ops-hub 2>/dev/null || true

echo "Starting new container on network $NET..." >> $LOG
docker run -d --name suganuma-ops-hub --network "$NET" --env-file .env.prod --restart unless-stopped ops-hub:latest >> $LOG 2>&1

[ -f ~/update-ops-proxy.sh ] && bash ~/update-ops-proxy.sh >> $LOG 2>&1

sleep 10
SW=$(curl -s --max-time 5 https://ops.suganuma.com.br/sw.js 2>/dev/null | head -c 30 || echo "FAIL")
echo "sw.js check: $SW" >> $LOG
echo "=== Deploy finished at $(date) ===" >> $LOG
