#!/bin/sh
set -e

# Injeta a URL real do backend no config do nginx
# BACKEND_URL deve ser definido como variável de ambiente no Railway
# Exemplo: BACKEND_URL=https://obras-backend.up.railway.app
if [ -z "$BACKEND_URL" ]; then
  echo "AVISO: BACKEND_URL não definido — usando http://localhost:8000"
  BACKEND_URL="http://localhost:8000"
fi

echo "▶ Backend URL: $BACKEND_URL"
sed -i "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
