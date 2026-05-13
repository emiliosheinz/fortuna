#!/usr/bin/env sh
# Usage: assemble-env.sh <app_name>
# Examples: assemble-env.sh web
#           assemble-env.sh root  (reads ./.env.example, writes ./.env, prefix=ROOT)
#
# Reads apps/<app_name>/.env.example and writes apps/<app_name>/.env.
# For each KEY in .env.example, requires ${PREFIX}_${KEY} in the current environment.
# PREFIX = uppercase(app_name) with non-alnum -> underscore.
# Special case: app_name "root" targets the repo root .env.example / .env with prefix ROOT.
#
# Writes what it can; at the end, lists any missing variables and exits 1 if any were missing.

set -eu

app_name="${1:-}"
[ -n "$app_name" ] || { echo "Error: <app_name> is required" >&2; exit 1; }

if [ "$app_name" = "root" ]; then
  app_dir="."
  example_path="./.env.example"
  out_path="./.env"
  prefix="ROOT"
else
  app_dir="apps/$app_name"
  example_path="$app_dir/.env.example"
  out_path="$app_dir/.env"
  prefix="$(printf '%s' "$app_name" | tr '[:lower:]' '[:upper:]' | sed 's/[^A-Z0-9]/_/g')"
fi

[ -d "$app_dir" ] || { echo "Error: $app_dir not found" >&2; exit 1; }
[ -f "$example_path" ] || { echo "Error: $example_path not found" >&2; exit 1; }

tmp_out="$(mktemp)"
trap 'rm -f "$tmp_out"' EXIT

missing_keys=""
written_count=0

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|'#'*) continue ;; esac
  case "$line" in "export "*) line="${line#export }" ;; esac

  key="$line"
  case "$line" in *=*) key="${line%%=*}";; esac

  # Trim spaces
  key="${key#"${key%%[![:space:]]*}"}"
  key="$(printf %s "$key" | sed 's/[[:space:]]*$//')"
  [ -n "$key" ] || continue
  case "$key" in '#'*) continue ;; esac

  env_name="${prefix}_${key}"   # e.g., WEB_PORT
  val="$(eval "printf %s \"\${$env_name-}\"")"

  if [ -z "$val" ]; then
    missing_keys="$missing_keys $env_name"
    continue
  fi

  printf '%s=%s\n' "$key" "$val" >> "$tmp_out"
  written_count=$((written_count + 1))
done < "$example_path"

mv "$tmp_out" "$out_path"
echo "Wrote $out_path with $written_count variables (prefix=$prefix)"

if [ -n "$missing_keys" ]; then
  echo ""
  echo "The following variables were missing and must be defined before running:"
  for m in $missing_keys; do echo "   - $m"; done
  echo ""
  exit 1
fi
