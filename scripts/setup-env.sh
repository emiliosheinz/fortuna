#!/usr/bin/env bash
set -euo pipefail

# Copies each apps/*/.env.example to apps/*/.env if not present (or when forced)
# Usage: scripts/setup-env.sh [-f|--force]
#   -f, --force   Overwrite existing .env files

FORCE=false
if [[ ${1:-} == "-f" || ${1:-} == "--force" ]]; then
  FORCE=true
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="$ROOT_DIR/apps"

if [[ ! -d "$APPS_DIR" ]]; then
  echo "No apps directory found at $APPS_DIR" >&2
  exit 1
fi

shopt -s nullglob
copied_any=false

for example in "$ROOT_DIR/.env.example" "$APPS_DIR"/*/.env.example; do
  env_file="$(dirname "$example")/.env"
  label="${example#"$ROOT_DIR/"}"
  if [[ -f "$env_file" && $FORCE == false ]]; then
    echo "[skip] ${label} already has a .env"
    continue
  fi
  cp "$example" "$env_file"
  echo "[ok]   Copied ${label} -> .env"
  copied_any=true
done

shopt -u nullglob

if [[ $copied_any == false ]]; then
  echo "Nothing to copy — all .env files already exist"
fi
