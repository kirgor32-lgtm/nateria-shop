#!/usr/bin/env bash
# Publish the site to the production server (https://136.234.25.25/nateria-shop/).
# Uploads the committed sources to /opt/sites/nateria-shop; the server builds them with the live CRM catalog
# (prices, texts, photos) and swaps the site folder. The CRM re-runs the same build by itself after every
# product edit, so this script is only needed when the site CODE changes.
# Usage: bash scripts/deploy-server.sh   (from the project root)
# GitHub Pages (sandbox) is deployed separately with a plain `npm run build` and gh-pages — no CRM there.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=nateria-shop
SERVER=root@136.234.25.25
KEY="$HOME/.ssh/selectel_ed25519"
git ls-files -z | xargs -0 tar -cf - | ssh -i "$KEY" -o BatchMode=yes "$SERVER" "
  set -eo pipefail; S=/opt/sites/$NAME
  mkdir -p \$S && find \$S -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
  tar -x -C \$S && chown -R crm:crm \$S /var/www/nateria
  sudo -u crm /opt/sites/build-site.sh $NAME 2>&1 | tail -n 5"
echo "deployed: https://136.234.25.25/$NAME/  (rollback: ssh in and swap $NAME.prev back)"
