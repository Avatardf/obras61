#!/bin/sh
set -e

# BACKEND_URL: URL interna do backend (rede privada Railway)
# Exemplo: http://backend.railway.internal:8000
if [ -z "$BACKEND_URL" ]; then
  echo "AVISO: BACKEND_URL não definido — usando http://localhost:8000"
  BACKEND_URL="http://localhost:8000"
fi

# Resolver DNS do ambiente (Railway usa DNS interno IPv6 para *.railway.internal)
RESOLVER=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)
[ -z "$RESOLVER" ] && RESOLVER="127.0.0.11"

echo "▶ Backend URL: $BACKEND_URL"
echo "▶ Resolver DNS: $RESOLVER"

sed -i "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g"   /etc/nginx/conf.d/default.conf
sed -i "s|RESOLVER_PLACEHOLDER|[${RESOLVER}]|g"        /etc/nginx/conf.d/default.conf

# Se o resolver for IPv4, remove os colchetes
sed -i "s|\[\([0-9.]*\)\]|\1|g" /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
