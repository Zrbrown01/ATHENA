#!/bin/sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
temporary_directory=$(mktemp -d /tmp/athena-recovery.XXXXXX)
backup_path="$temporary_directory/athena-local-backup.sql"
restore_path="$temporary_directory/athena-local-restore.sqlite"

cleanup() {
  rm -f "$backup_path" "$restore_path"
  rmdir "$temporary_directory"
}
trap cleanup EXIT HUP INT TERM

cd "$repository_root"
npx wrangler d1 export athena-preview --local --config wrangler.local.jsonc --output "$backup_path" -y >/dev/null
sqlite3 "$restore_path" < "$backup_path"

integrity=$(sqlite3 "$restore_path" "pragma integrity_check;")
foreign_key_violations=$(sqlite3 "$restore_path" "pragma foreign_key_check;")
application_tables=$(sqlite3 "$restore_path" "select count(*) from sqlite_schema where type='table' and name not like 'sqlite_%' and name not in ('d1_migrations', '_cf_METADATA');")
migrations=$(sqlite3 "$restore_path" "select count(*) from d1_migrations;")
latest_migration=$(sqlite3 "$restore_path" "select name from d1_migrations order by id desc limit 1;")
events=$(sqlite3 "$restore_path" "select count(*) from preview_events;")
outbox=$(sqlite3 "$restore_path" "select count(*) from preview_outbox;")
tenants=$(sqlite3 "$restore_path" "select count(distinct tenant_id) from preview_events;")
expected_tables=${ATHENA_EXPECTED_APP_TABLES:-195}
expected_migrations=$(find drizzle -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')
checksum=$(shasum -a 256 "$backup_path" | awk '{print $1}')
byte_size=$(wc -c < "$backup_path" | tr -d ' ')

test "$integrity" = "ok"
test -z "$foreign_key_violations"
test "$application_tables" = "$expected_tables"
test "$migrations" = "$expected_migrations"
test "$events" = "$outbox"
test "$tenants" = "1"

printf '{"providerMode":"local_verified","productionMutation":false,"sha256":"%s","byteSize":%s,"applicationTables":%s,"migrations":%s,"latestMigration":"%s","events":%s,"outbox":%s,"tenants":%s,"integrity":"ok","foreignKeyViolations":0}\n' \
  "$checksum" "$byte_size" "$application_tables" "$migrations" "$latest_migration" "$events" "$outbox" "$tenants"
