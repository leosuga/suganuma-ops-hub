#!/bin/bash
# Varredura do backlog Raindrop → Hub: dispara o workflow em loop até esgotar o backlog.
# Log: /tmp/raindrop-sweep.log
cd /Users/leo/Documents/Projetos/webapp_pessoal/suganuma-ops-hub
REPO="leosuga/suganuma-ops-hub"

count_db() {
  ssh -o BatchMode=yes LeoVM "docker exec supabase-db psql -U supabase_admin -d postgres -t -A -c \"select count(*) from webhook_event where source='raindrop'\""
}

PREV=$(count_db)
echo "$(date '+%H:%M') início — processados: $PREV" | tee -a /tmp/raindrop-sweep.log

for i in $(seq 1 30); do
  gh workflow run "Raindrop Sync" --repo "$REPO" || { echo "[$i] falha ao disparar" | tee -a /tmp/raindrop-sweep.log; break; }
  sleep 10
  RUN_ID=$(gh run list --repo "$REPO" --workflow=raindrop-sync.yml --limit 1 --json databaseId --jq '.[0].databaseId')
  gh run watch "$RUN_ID" --repo "$REPO" --exit-status --interval 20 > /dev/null 2>&1
  STATUS=$?
  CUR=$(count_db)
  DELTA=$((CUR - PREV))
  echo "[$i] run $RUN_ID — delta: $DELTA — acumulado: $CUR" | tee -a /tmp/raindrop-sweep.log
  if [ "$STATUS" != "0" ]; then
    echo "[$i] run FALHOU — abortando" | tee -a /tmp/raindrop-sweep.log
    break
  fi
  if [ "$DELTA" -lt 100 ]; then
    echo "backlog esgotado (último run processou $DELTA)" | tee -a /tmp/raindrop-sweep.log
    break
  fi
  PREV=$CUR
done

FINAL=$(count_db)
echo "$(date '+%H:%M') fim — total processado: $FINAL" | tee -a /tmp/raindrop-sweep.log
ssh -o BatchMode=yes LeoVM "docker exec supabase-db psql -U supabase_admin -d postgres -t -A -c \"
select 'notas: ' || (select count(*) from note where 'raindrop' = any(tags));
select 'inbox: ' || (select count(*) from inbox_item where source='raindrop');\""