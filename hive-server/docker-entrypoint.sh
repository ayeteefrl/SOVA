#!/bin/sh
# Volumes are often mounted owned by root. Make the data folder writable for the unprivileged "node" user,
# then drop privileges and replace this shell with Node (so Node receives SIGTERM directly).
set -e
DATA="${QT_DATA_DIR:-/data}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA"
  chown -R node:node "$DATA"
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=node --regid=node --init-groups node server/index.mjs
  fi
  exec su node -s /bin/sh -c 'exec node server/index.mjs'
fi
exec node server/index.mjs
