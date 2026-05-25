#!/usr/bin/env bash
set -euo pipefail

# Copies .env.example to .env at the repo root.
# Usage: scripts/setup-env.sh [-f|--force]
#   -f, --force   Overwrite an existing .env

FORCE=false
if [[ ${1:-} == "-f" || ${1:-} == "--force" ]]; then
  FORCE=true
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT_DIR/.env.example"
TARGET="$ROOT_DIR/.env"

if [[ ! -f "$EXAMPLE" ]]; then
  echo "Error: $EXAMPLE not found" >&2
  exit 1
fi

if [[ -f "$TARGET" && $FORCE == false ]]; then
  echo "[skip] .env already exists (use -f to overwrite)"
  exit 0
fi

cp "$EXAMPLE" "$TARGET"
echo "[ok]   Copied .env.example -> .env"
