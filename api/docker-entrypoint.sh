#!/bin/sh
set -e
if [ -n "$UID" ] && [ -n "$GID" ]; then
  chown -R "$UID:$GID" /config 2>/dev/null || true
fi
npx prisma migrate deploy
exec node build/index.js
