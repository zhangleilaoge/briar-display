#!/bin/bash
set -e

cd /home/ubuntu/Documents/briar-display

export PATH="/home/ubuntu/.bun/bin:$PATH"
export NVM_DIR="/home/ubuntu/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use

echo '=== Git Pull ==='
unset http_proxy
unset https_proxy
unset HTTP_PROXY
unset HTTPS_PROXY
git pull origin master

echo '=== MySQL Migrate ==='
mysql -u zhanglei -p'@zym892221' -h 127.0.0.1 briar_display < packages/briar-node/src/db/migrate.sql

echo '=== Install Deps ==='
bun install

echo '=== Build Shared ==='
bun run --filter @briar/shared build

echo '=== Build Node ==='
bun run --filter @briar/node build

echo '=== Restart PM2 ==='
pm2 restart ecosystem.config.cjs

echo '=== Done ==='
pm2 logs --lines 20 --timestamp
