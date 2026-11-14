#!/usr/bin/env bash
# Build the site wired to the CRM and publish it to the production server.
# Usage: bash scripts/deploy-server.sh   (from the project root)
# GitHub Pages (sandbox) is deployed separately with a plain `npm run build` and gh-pages — no CRM there.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER=root@136.234.25.25
KEY="$HOME/.ssh/selectel_ed25519"
set -a; . ./.env.server; set +a
npm run build
tar -C dist -cf - . | ssh -i "$KEY" -o BatchMode=yes "$SERVER" '
  set -e; D=/var/www/nateria
  rm -rf $D/nateria-shop.new && mkdir -p $D/nateria-shop.new && tar -x -C $D/nateria-shop.new
  rm -rf $D/nateria-shop.prev && { [ -d $D/nateria-shop ] && mv $D/nateria-shop $D/nateria-shop.prev || true; }
  mv $D/nateria-shop.new $D/nateria-shop'
# put the local tree back into the plain (sandbox) state
git checkout -- src/prices.generated.json 2>/dev/null || true
unset VITE_CRM_API VITE_CRM_KEY CRM_CATALOG_URL CRM_SITE_KEY
npm run build >/dev/null
echo "deployed: https://136.234.25.25/nateria-shop/  (rollback: ssh in and swap nateria-shop.prev back)"
