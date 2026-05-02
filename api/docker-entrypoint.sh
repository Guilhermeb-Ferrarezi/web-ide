#!/usr/bin/env sh
set -eu

if ! command -v codex >/dev/null 2>&1; then
  npm install -g @openai/codex
fi

exec "$@"
