#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/climatewallah"

cd "$APP_DIR"
git pull --ff-only

"$APP_DIR/backend/venv/bin/python" -m pip install -r "$APP_DIR/backend/requirements.txt"

cd "$APP_DIR/frontend"
npm ci --legacy-peer-deps
REACT_APP_BACKEND_URL=https://climatewallah.com CI=true npm run build

chown -R climatewallah:climatewallah "$APP_DIR/backend"
find "$APP_DIR/frontend/build" -type d -exec chmod 755 {} \;
find "$APP_DIR/frontend/build" -type f -exec chmod 644 {} \;

systemctl restart climatewallah
nginx -t
systemctl reload nginx

curl --fail --silent --show-error http://127.0.0.1:8000/api/health
echo
echo "ClimateWallah deployment updated successfully."
