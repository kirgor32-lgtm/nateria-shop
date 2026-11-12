#!/usr/bin/env bash
# Автопубликация сайта hvostik-minimal при изменении цен в CRM.
# Запускается по расписанию (cron). Ничего не делает, если цены не изменились
# или CRM сейчас не отвечает — просто ждёт следующего запуска.
set -e
cd "$(dirname "$0")/.."
mkdir -p logs
LOG="logs/autodeploy.log"
ts() { date '+%Y-%m-%d %H:%M:%S'; }

exec >> "$LOG" 2>&1
echo "=== $(ts) автодеплой: проверка цен ==="

node scripts/fetch-crm-prices.mjs

if git diff --quiet -- src/prices.generated.json; then
  echo "$(ts) цены не изменились, выходим"
  exit 0
fi

echo "$(ts) цены изменились — пересобираю и публикую"
npm run build

git add -A
git commit -m "auto: цены из CRM $(ts)"
git push origin main

npx --yes gh-pages@6.3.0 -d dist -m "auto-deploy: цены из CRM $(ts)"

echo "$(ts) готово, опубликовано"
