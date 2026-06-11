#!/bin/bash
set -e

echo "▶ Aplicando migrations..."
alembic upgrade head

echo "▶ Iniciando servidor na porta ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
