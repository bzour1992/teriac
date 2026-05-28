#!/usr/bin/env bash
# Migration runner for apps/api/migrations/*.sql.
#
# Reads DB connection from the project's .env (../../.env relative to this script).
# Applies each migration file in lexical order, recording results in
# _teriac_migrations so re-runs are no-ops.
#
# Usage:
#   bash apps/api/scripts/run-migrations.sh             # apply pending
#   bash apps/api/scripts/run-migrations.sh --dry-run   # list pending only
#   bash apps/api/scripts/run-migrations.sh --status    # show applied vs pending
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="../../.env"
[[ -f "$ENV_FILE" ]] || { echo "missing $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC2046
export $(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' "$ENV_FILE" | xargs)

MIG_DIR="migrations"
[[ -d "$MIG_DIR" ]] || { echo "no $MIG_DIR" >&2; exit 1; }

mysql_q() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -sN -e "$1"
}

mysql_apply() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
    --abort-source-on-error --binary-mode=1 < "$1"
}

ensure_tracking_table() {
  mysql_apply "$MIG_DIR/0000_create_migrations_table.sql" >/dev/null 2>&1 || true
}

list_applied() {
  mysql_q "SELECT id FROM _teriac_migrations ORDER BY id;" 2>/dev/null || true
}

DRY=0
STATUS=0
case "${1:-}" in
  --dry-run) DRY=1 ;;
  --status)  STATUS=1 ;;
esac

ensure_tracking_table

APPLIED=$(list_applied || true)

echo "Connected: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "-----"

PENDING=()
for f in "$MIG_DIR"/[0-9]*.sql; do
  id=$(basename "$f" .sql)
  if echo "$APPLIED" | grep -qx "$id"; then
    [[ $STATUS -eq 1 ]] && echo "applied: $id"
  else
    PENDING+=("$f")
    [[ $STATUS -eq 1 ]] && echo "pending: $id"
  fi
done

if [[ $STATUS -eq 1 ]]; then
  exit 0
fi

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "No pending migrations."
  exit 0
fi

echo "Pending migrations:"
for f in "${PENDING[@]}"; do
  echo "  - $(basename "$f")"
done
echo "-----"

if [[ $DRY -eq 1 ]]; then
  echo "Dry-run only — nothing applied."
  exit 0
fi

for f in "${PENDING[@]}"; do
  id=$(basename "$f" .sql)
  checksum=$(shasum -a 256 "$f" | awk '{print $1}')
  echo ">> $id"
  start=$(python3 -c 'import time; print(int(time.time()*1000))')
  if mysql_apply "$f"; then
    end=$(python3 -c 'import time; print(int(time.time()*1000))')
    duration=$(( end - start ))
    mysql_q "INSERT INTO _teriac_migrations(id,duration_ms,checksum) VALUES ('$id', $duration, '$checksum');"
    echo "   ok (${duration} ms)"
  else
    echo "   FAILED — stopping. Fix the file, re-run."
    exit 1
  fi
done

echo "-----"
echo "Done."
