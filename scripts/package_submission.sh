#!/usr/bin/env bash
set -euo pipefail

# packages the repository for submission. Usage:
#   ./scripts/package_submission.sh [path/to/moveproof_demo.mp4]

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTDIR="deploy/submission-$TIMESTAMP"
ARCHIVE="deploy/submission-$TIMESTAMP.tar.gz"

echo "Creating package in $OUTDIR"
mkdir -p "$OUTDIR"

# Files and folders to include
INCLUDE=(
  frontend
  backend
  sim
  docker-compose.yml
  .env.example
  LICENSE
  docker-compose.vultr.yml
  Dockerfile.fly
  README.md
  scripts/record_demo.js
)

for p in "${INCLUDE[@]}"; do
  if [ -e "$p" ]; then
    rsync -a --exclude='.git' --exclude='node_modules' --exclude='venv' "$p" "$OUTDIR/"
  fi
done

# Ensure demo downloads path exists
mkdir -p "$OUTDIR/frontend/public/downloads"
MP4_SRC="${1:-/tmp/moveproof_demo.mp4}"
if [ -f "$MP4_SRC" ]; then
  echo "Adding demo MP4 from $MP4_SRC"
  cp "$MP4_SRC" "$OUTDIR/frontend/public/downloads/moveproof_demo.mp4"
else
  echo "Warning: demo MP4 not found at $MP4_SRC. Package will not include the video."
fi

echo "Creating archive $ARCHIVE"
tar -C deploy -czf "$ARCHIVE" "$(basename "$OUTDIR")"

echo "Package created: $ARCHIVE"
echo "To inspect: tar -tf $ARCHIVE"

echo "Done."
