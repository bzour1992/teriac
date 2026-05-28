#!/usr/bin/env bash
# Drizzle-kit 0.31.x introspection cleanup. Run after `drizzle-kit introspect`.
#
# Patches several known issues:
#   1. Missing `tinyint` / `bigint` imports (introspect doesn't add them even
#      though it uses them).
#   2. Literal `.default('NULL')` on every nullable column.
#   3. Triple-quoted string defaults like `.default('''en''')`.
#   4. `.default('current_timestamp(3)')` (string literal) — drop, the DB DDL
#      handles the default; we don't need it in TS.
set -euo pipefail

cd "$(dirname "$0")/.."

SCHEMA="drizzle/schema.ts"

[[ -f "$SCHEMA" ]] || { echo "post-introspect: $SCHEMA not found" >&2; exit 1; }

count_matches() {
  # Stable count helper that always returns a single number, never empty.
  # `grep -c` exits 1 on no match, which set -e would treat as fatal — guard it.
  local pattern=$1
  local count
  count=$(grep -cE "$pattern" "$SCHEMA" 2>/dev/null) || count=0
  echo "$count"
}

# 1. Ensure tinyint and bigint are imported from drizzle-orm/mysql-core.
for sym in tinyint bigint; do
  if ! grep -qE "import \{[^}]*\b${sym}\b[^}]*\} from \"drizzle-orm/mysql-core\"" "$SCHEMA"; then
    # Insert ` ${sym},` right after the opening `{` of the first import from mysql-core.
    sed -i.bak -E "s|(import \{)( *[^}]+\} from \"drizzle-orm/mysql-core\")|\\1 ${sym},\\2|" "$SCHEMA"
    rm -f "${SCHEMA}.bak"
    echo "post-introspect: added missing import: ${sym}"
  fi
done

# 2. .default('NULL') artifacts.
n=$(count_matches "\.default\('NULL'\)")
if [[ "$n" -gt 0 ]]; then
  sed -i.bak "s/\.default('NULL')//g" "$SCHEMA"
  rm -f "${SCHEMA}.bak"
  echo "post-introspect: stripped $n .default('NULL') artifacts"
fi

# 3. Triple-quoted defaults: .default('''X''')  →  .default('X')
n=$(count_matches "\.default\('''[^']*'''\)")
if [[ "$n" -gt 0 ]]; then
  sed -i.bak -E "s/\.default\('''([^']*)'''\)/.default('\\1')/g" "$SCHEMA"
  rm -f "${SCHEMA}.bak"
  echo "post-introspect: collapsed $n triple-quoted defaults"
fi

# 4. .default('current_timestamp(...)') — DB handles it.
n=$(count_matches "\.default\('current_timestamp\([0-9]+\)'\)")
if [[ "$n" -gt 0 ]]; then
  sed -i.bak -E "s/\.default\('current_timestamp\([0-9]+\)'\)//g" "$SCHEMA"
  rm -f "${SCHEMA}.bak"
  echo "post-introspect: stripped $n current_timestamp() string defaults"
fi

echo "post-introspect: done"
