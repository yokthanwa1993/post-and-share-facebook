#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "❌ ไม่พบไฟล์ .env ใน $SCRIPT_DIR"
  exit 1
fi

cd "$SCRIPT_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "📦 กำลังติดตั้ง dependencies..."
  npm install
fi

node post-and-share.js "$@"
