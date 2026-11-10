#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Install Node.js 22.13 or later, then run this script again."
  exit 1
fi
if [ ! -f node_modules/vinext/dist/cli.js ]; then
  echo "Dependencies are missing. Run npm run install:ci in this folder first."
  exit 1
fi
exec npm run dev -- --port 5173
