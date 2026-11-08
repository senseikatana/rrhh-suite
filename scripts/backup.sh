#!/usr/bin/env bash
# Copia de seguridad lógica de PostgreSQL con retención.
#
#   DATABASE_URL="postgresql://…" ./scripts/backup.sh
#
# Variables:
#   BACKUP_DIR    carpeta de salida (por defecto ./backups)
#   BACKUP_KEEP   copias a conservar (por defecto 30)
set -euo pipefail

: "${DATABASE_URL:?Define DATABASE_URL antes de ejecutar el backup}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP:-30}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/rrhh-$STAMP.dump"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$FILE"
elif command -v docker >/dev/null 2>&1; then
  if ! docker run --rm -e PGURL="$DATABASE_URL" postgres:17-alpine \
    sh -c 'pg_dump "$PGURL" --format=custom --no-owner' > "$FILE"; then
    rm -f "$FILE"
    echo "La copia ha fallado" >&2
    exit 1
  fi
else
  echo "Necesitas pg_dump o Docker para hacer la copia." >&2
  exit 1
fi

# Conserva solo las N copias más recientes.
ls -1t "$BACKUP_DIR"/rrhh-*.dump 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "✓ Copia creada: $FILE"
echo "  Restaurar: pg_restore --clean --if-exists -d \"\$DATABASE_URL\" $FILE"
