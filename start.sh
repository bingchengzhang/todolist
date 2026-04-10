#!/bin/bash
# Load .env if running locally
[ -f "$(dirname "$0")/.env" ] && set -a && source "$(dirname "$0")/.env" && set +a

PORT=${PORT:-5000}

exec gunicorn app:app --bind "0.0.0.0:$PORT" --workers 2
