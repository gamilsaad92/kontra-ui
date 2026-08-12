#!/usr/bin/env bash
# scripts/sync-kontra-ui.sh
#
# Keeps ui/src/ in sync with kontra-ui-clone/ui/src/ (the canonical dev source).
# Run manually or automatically via the git pre-commit hook.
#
# Direction: kontra-ui-clone/ui/src/ → ui/src/
#            kontra-ui-clone/shared/  → ui/src/shared/
#            kontra-ui-clone/api/     → api/
#
# Uses `cp -r src/. dst/` which merges — it updates/adds files but never
# removes files that only exist in the destination.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔄  Syncing kontra-ui-clone/ui/src → ui/src …"
cp -r "$ROOT/kontra-ui-clone/ui/src/." "$ROOT/ui/src/"
echo "✓   ui/src/ updated"

echo "🔄  Syncing kontra-ui-clone/shared → ui/src/shared …"
mkdir -p "$ROOT/ui/src/shared"
cp -r "$ROOT/kontra-ui-clone/shared/." "$ROOT/ui/src/shared/"
echo "✓   ui/src/shared/ updated"

echo "🔄  Syncing kontra-ui-clone/shared → shared …"
mkdir -p "$ROOT/shared"
cp -r "$ROOT/kontra-ui-clone/shared/." "$ROOT/shared/"
echo "✓   shared/ updated"

echo "🔄  Syncing kontra-ui-clone/shared → kontra-ui-clone/ui/src/shared …"
mkdir -p "$ROOT/kontra-ui-clone/ui/src/shared"
cp -r "$ROOT/kontra-ui-clone/shared/." "$ROOT/kontra-ui-clone/ui/src/shared/"
echo "✓   kontra-ui-clone/ui/src/shared/ updated"

if [ -d "$ROOT/kontra-ui-clone/api" ] && [ -d "$ROOT/api" ]; then
  echo "🔄  Syncing kontra-ui-clone/api → api …"
  # Exclude node_modules and dist to avoid copying large build artifacts
  find "$ROOT/kontra-ui-clone/api" \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -name ".env" \
    -type f | while read -r src_file; do
      rel="${src_file#$ROOT/kontra-ui-clone/api/}"
      dst_file="$ROOT/api/$rel"
      mkdir -p "$(dirname "$dst_file")"
      cp "$src_file" "$dst_file"
    done
  echo "✓   api/ updated"
fi

node "$ROOT/scripts/validate-transaction-record-requirements.mjs"

echo ""
echo "✅  Sync complete."
