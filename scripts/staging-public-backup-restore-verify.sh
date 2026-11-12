#!/usr/bin/env bash
set -Eeuo pipefail
set +x
umask 077

readonly EXPECTED_REF="refs/heads/staging-migrations"
readonly EXPECTED_CONFIRMATION="BACKUP-RESTORE jpemuoapbgzwapydqiio"
readonly PG_IMAGE="postgres:17.11-alpine"
readonly SUPABASE_CLI_VERSION="3.0.0"
readonly WORK_DIR="${RUNNER_TEMP:?RUNNER_TEMP is required}/kontra-staging-restore-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:?}"
readonly STACK_DIR="$WORK_DIR/supabase"
readonly CLI_DIR="$WORK_DIR/cli"
readonly CA_PATH="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}/ops/staging-runner/supabase-root.crt"
readonly NETWORK="kontra-restore-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
readonly LOCAL_DB_PORT="54322"

cleanup() {
  local result=$?
  set +e
  if [[ -x "$CLI_DIR/node_modules/.bin/supabase" && -f "$STACK_DIR/supabase/config.toml" ]]; then
    (cd "$STACK_DIR" && "$CLI_DIR/node_modules/.bin/supabase" stop --no-backup) >/dev/null 2>&1
  fi
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  unset STAGING_DATABASE_URL BACKUP_KEY
  rm -rf "$WORK_DIR"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

fail() {
  echo "Staging backup/restore verification stopped: $1" >&2
  exit 1
}

[[ "${GITHUB_REF:-}" == "$EXPECTED_REF" ]] || fail "wrong branch"
[[ "${BACKUP_CONFIRMATION:-}" == "$EXPECTED_CONFIRMATION" ]] || fail "workflow confirmation phrase did not match"
: "${STAGING_DATABASE_URL:?staging connection is unavailable}"
[[ -s "$CA_PATH" && -s "${CA_PATH}.sha256" ]] || fail "pinned staging CA files are missing"

mkdir -p "$WORK_DIR" "$STACK_DIR" "$CLI_DIR"
chmod 700 "$WORK_DIR" "$STACK_DIR" "$CLI_DIR"
export NPM_CONFIG_CACHE="$WORK_DIR/npm-cache"
export BACKUP_KEY
BACKUP_KEY="$(openssl rand -hex 32)"
echo "::add-mask::$BACKUP_KEY"

npm install --prefix "$CLI_DIR" --no-audit --no-fund "supabase@$SUPABASE_CLI_VERSION" >/dev/null 2>&1 ||
  fail "could not install the pinned Supabase CLI"
SUPABASE="$CLI_DIR/node_modules/.bin/supabase"
(cd "$STACK_DIR" && "$SUPABASE" init --force) >/dev/null 2>&1 ||
  fail "could not initialize the temporary Supabase config"

python3 - "$STACK_DIR/supabase/config.toml" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
lines = path.read_text().splitlines()
section = None
seen = set()
out = []
for line in lines:
    m = re.match(r"^\s*\[([^\]]+)\]", line)
    if m:
        section = m.group(1)
    if section == "db":
        for key, value in (
            ("major_version", "17"),
            ("port", "54322"),
        ):
            if re.match(rf"^\s*{key}\s*=", line):
                line = f"{key} = {value}"
                seen.add(key)
    out.append(line)
if not any(re.match(r"^\s*\[db\]", line) for line in out):
    raise SystemExit("Supabase config has no db section")
section = None
insert_at = None
for i, line in enumerate(out):
    m = re.match(r"^\s*\[([^\]]+)\]", line)
    if m:
        if section == "db" and insert_at is None:
            insert_at = i
        section = m.group(1)
if section == "db" and insert_at is None:
    insert_at = len(out)
if insert_at is not None:
    missing = [k for k in ("major_version", "port") if k not in seen]
    out[insert_at:insert_at] = [
        "major_version = 17" if k == "major_version" else "port = 54322"
        for k in missing
    ]
path.write_text("\n".join(out) + "\n")
path.chmod(0o600)
PY

docker network create --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$NETWORK" >/dev/null ||
  fail "could not create the isolated loopback-only Docker network"
(cd "$STACK_DIR" && "$SUPABASE" start \
  --network-id "$NETWORK" \
  --exclude realtime,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,analytics,vector,logflare \
  >"$WORK_DIR/supabase-start.log" 2>&1) ||
  fail "the local Supabase PostgreSQL 17 stack failed to start"

ss -ltnH | awk -v p=":$LOCAL_DB_PORT" '
  $4 ~ p"$" { found=1; if ($4 !~ /^127\.0\.0\.1:/ && $4 !~ /^\[::1\]:/) bad=1 }
  END { exit (!found || bad) }
' || fail "the local database port is not bound exclusively to loopback"

# Supabase CLI 3.0.0 uses its built-in credential for the primary local DB;
# [db].password does not configure that container. Read the DB_URL rendered by the CLI so the
# client uses the password the running local database accepts, without hardcoding it.
LOCAL_STATUS_JSON="$WORK_DIR/local-supabase-status.json"
LOCAL_STATUS_STDERR="$WORK_DIR/supabase-status.stderr"

print_local_supabase_status_failure() {
  local error_file="$1"
  local exit_code="$2"
  printf 'Supabase status command failed (exit code %s).\n' "$exit_code" >&2
  if [[ -s "$error_file" ]]; then
    sed -E 's#[[:alpha:]][[:alnum:].+-]*://[^[:space:]]+#<redacted URL>#g; s#((password|PGPASSWORD|token|secret)[=:][[:space:]]*)[^[:space:],;]+#\1<redacted>#Ig' "$error_file" |
      awk 'NR <= 5' >&2
  else
    echo "Supabase status command emitted no stderr." >&2
  fi
}

if (cd "$STACK_DIR" && "$SUPABASE" status -o json >"$LOCAL_STATUS_JSON" 2>"$LOCAL_STATUS_STDERR"); then
  :
else
  LOCAL_STATUS_EXIT=$?
  print_local_supabase_status_failure "$LOCAL_STATUS_STDERR" "$LOCAL_STATUS_EXIT"
  fail "Supabase status command failed before local database settings were read"
fi
chmod 600 "$LOCAL_STATUS_JSON"
python3 - "$LOCAL_STATUS_JSON" "$WORK_DIR/local-db.env" "$LOCAL_DB_PORT" <<'PY'
import json
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

try:
    status = json.loads(Path(sys.argv[1]).read_text())
except (OSError, json.JSONDecodeError):
    print("Supabase status output was not readable JSON.", file=sys.stderr)
    sys.exit(1)
if not isinstance(status, dict):
    print("Supabase status output was not a JSON object.", file=sys.stderr)
    sys.exit(1)
raw_url = status.get("DB_URL")
if not isinstance(raw_url, str) or not raw_url:
    print("Supabase status output did not contain DB_URL.", file=sys.stderr)
    sys.exit(1)
try:
    parsed = urlsplit(raw_url)
    password = unquote(parsed.password or "")
    valid_url = (
        parsed.scheme in {"postgres", "postgresql"}
        and parsed.username == "postgres"
        and parsed.hostname == "127.0.0.1"
        and parsed.port == int(sys.argv[3])
        and parsed.path == "/postgres"
        and not parsed.query
        and not parsed.fragment
        and password
        and chr(10) not in password
        and chr(13) not in password
    )
except ValueError:
    valid_url = False
    password = ""
if not valid_url:
    print("Supabase status DB_URL did not match the expected loopback PostgreSQL settings.", file=sys.stderr)
    sys.exit(1)
env_file = Path(sys.argv[2])
env_file.write_text("PGPASSWORD=" + password + chr(10))
env_file.chmod(0o600)
PY

print_local_psql_failure() {
  local error_file="$1"
  local label="$2"
  local kind
  if grep -Eiq 'connection refused|could not connect|could not translate host name|no route to host|timeout expired|password authentication failed|database "[^"]+" does not exist|role "[^"]+" does not exist' "$error_file"; then
    kind="connection/authentication"
  elif grep -Eiq '^(ERROR|FATAL|psql: error):' "$error_file"; then
    kind="PostgreSQL query/server"
  else
    kind="Docker or client startup"
  fi
  printf '%s failed (%s).\n' "$label" "$kind" >&2
  awk '/^(psql: error:|ERROR:|FATAL:|DETAIL:|HINT:)/ && count++ < 4 { print }' "$error_file" |
    sed -E 's#postgres(ql)?://[^[:space:]]+#<redacted PostgreSQL URI>#g; s#(password|PGPASSWORD)[=:][^[:space:]]+#credential=<redacted>#Ig' >&2
}

LOCAL_DB_READINESS_ERROR_LOG="$WORK_DIR/local-db-readiness.stderr"
if ! docker run --rm --network host --env-file "$WORK_DIR/local-db.env" "$PG_IMAGE" psql -h 127.0.0.1 -p "$LOCAL_DB_PORT" -U postgres -d postgres -X -v ON_ERROR_STOP=1 -Atc 'SELECT 1' >"$WORK_DIR/local-db-readiness.txt" 2>"$LOCAL_DB_READINESS_ERROR_LOG"; then
  print_local_psql_failure "$LOCAL_DB_READINESS_ERROR_LOG" "Local PostgreSQL authenticated readiness check"
  fail "local Supabase PostgreSQL authenticated readiness check failed"
fi
[[ "$(<"$WORK_DIR/local-db-readiness.txt")" == "1" ]] ||
  fail "local Supabase PostgreSQL authenticated readiness check returned unexpected output"

LOCAL_DEPENDENCIES_SQL="
SELECT 'postgres_major_version',
       (current_setting('server_version_num')::integer / 10000)::text,
       '17',
       (current_setting('server_version_num')::integer / 10000 = 17)::text
UNION ALL
SELECT 'extension:' || expected.name,
       COALESCE(installed.extversion, 'missing'),
       expected.version,
       COALESCE(installed.extversion = expected.version, false)::text
FROM (VALUES
  ('plpgsql', '1.0'),
  ('pgcrypto', '1.3'),
  ('uuid-ossp', '1.1'),
  ('pg_stat_statements', '1.11'),
  ('supabase_vault', '0.3.1')
) AS expected(name, version)
LEFT JOIN pg_extension AS installed ON installed.extname::text = expected.name
UNION ALL
SELECT 'role:' || expected.name,
       CASE WHEN installed.rolname IS NULL THEN 'missing' ELSE 'present' END,
       'present',
       (installed.rolname IS NOT NULL)::text
FROM (VALUES
  ('anon'), ('authenticated'), ('authenticator'), ('postgres'),
  ('service_role'), ('supabase_admin'), ('supabase_auth_admin'),
  ('supabase_storage_admin')
) AS expected(name)
LEFT JOIN pg_roles AS installed ON installed.rolname::text = expected.name
UNION ALL
SELECT 'function:' || expected.signature,
       CASE WHEN to_regprocedure(expected.signature) IS NULL THEN 'missing' ELSE 'present' END,
       'present',
       (to_regprocedure(expected.signature) IS NOT NULL)::text
FROM (VALUES ('auth.uid()'), ('auth.role()'), ('auth.email()'), ('auth.jwt()'))
  AS expected(signature)
UNION ALL
SELECT 'table:' || expected.name,
       CASE WHEN to_regclass(expected.name) IS NULL THEN 'missing' ELSE 'present' END,
       'present',
       (to_regclass(expected.name) IS NOT NULL)::text
FROM (VALUES ('storage.objects'), ('storage.buckets')) AS expected(name)
ORDER BY 1
"
DEPENDENCY_ERROR_LOG="$WORK_DIR/dependencies.stderr"
if ! docker run --rm --network host --env-file "$WORK_DIR/local-db.env" "$PG_IMAGE" \
  psql -h 127.0.0.1 -p "$LOCAL_DB_PORT" -U postgres -d postgres \
  -X -v ON_ERROR_STOP=1 -AtF '|' -c "$LOCAL_DEPENDENCIES_SQL" >"$WORK_DIR/dependencies.txt" 2>"$DEPENDENCY_ERROR_LOG"; then
  print_local_psql_failure "$DEPENDENCY_ERROR_LOG" "Local prerequisite query"
  fail "could not query local Supabase prerequisites"
fi

DEPENDENCY_FAILURES=0
DEPENDENCY_COUNT=0
while IFS='|' read -r requirement actual expected passed; do
  [[ -n "$requirement" && -n "$passed" ]] || fail "local Supabase prerequisite output was incomplete"
  DEPENDENCY_COUNT=$((DEPENDENCY_COUNT + 1))
  case "$passed" in
    true)
      ;;
    false)
      printf 'Local Supabase prerequisite failed: %s (actual=%s; expected=%s)\n' \
        "$requirement" "$actual" "$expected" >&2
      DEPENDENCY_FAILURES=1
      ;;
    *)
      fail "local Supabase prerequisite output had a malformed boolean for $requirement"
      ;;
  esac
done <"$WORK_DIR/dependencies.txt"
[[ "$DEPENDENCY_COUNT" -eq 20 ]] || fail "local Supabase prerequisite output was incomplete"
[[ "$DEPENDENCY_FAILURES" -eq 0 ]] || fail "local Supabase prerequisite check failed; see named prerequisite(s) above"

# This is the first staging database connection in the job. The existing script
# validates project identity, verify-full, the reviewed CA, and its SHA-256 pin.
GITHUB_REF="$EXPECTED_REF" bash "$GITHUB_WORKSPACE/scripts/staging-connection-smoke.sh" ||
  fail "the protected staging connection preflight failed"

docker run --rm --network host \
  -e STAGING_DATABASE_URL -e PGSSLMODE=verify-full \
  -e PGSSLROOTCERT=/certs/supabase-root.crt \
  -v "$CA_PATH:/certs/supabase-root.crt:ro" \
  -v "$WORK_DIR:/backup" \
  "$PG_IMAGE" sh -ec '
    pg_dump "$STAGING_DATABASE_URL" --schema=public --format=custom --no-owner \
      --file=/backup/staging-public.dump
    pg_restore --list /backup/staging-public.dump >/dev/null
  ' >/dev/null 2>&1 || fail "custom-format staging dump or archive validation failed"

sha256sum "$WORK_DIR/staging-public.dump" >"$WORK_DIR/staging-public.sha256"
sha256sum --check "$WORK_DIR/staging-public.sha256" >/dev/null ||
  fail "source backup checksum verification failed"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -pass env:BACKUP_KEY \
  -in "$WORK_DIR/staging-public.dump" -out "$WORK_DIR/staging-public.dump.enc" ||
  fail "backup encryption failed"
sha256sum "$WORK_DIR/staging-public.dump.enc" >"$WORK_DIR/staging-public.dump.enc.sha256"
rm -f "$WORK_DIR/staging-public.dump"
sha256sum --check "$WORK_DIR/staging-public.dump.enc.sha256" >/dev/null ||
  fail "encrypted backup checksum verification failed"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_KEY \
  -in "$WORK_DIR/staging-public.dump.enc" -out "$WORK_DIR/restore.dump" ||
  fail "backup decryption failed"
docker run --rm --network host -v "$WORK_DIR:/backup:ro" "$PG_IMAGE" \
  pg_restore --list /backup/restore.dump >/dev/null 2>&1 ||
  fail "decrypted custom-format archive validation failed"

print_local_restore_failure() {
  local error_file="$1"
  local exit_code="$2"
  python3 - "$error_file" "$exit_code" <<'PY'
import re
import sys
from pathlib import Path

raw = Path(sys.argv[1]).read_text(errors="replace")
connection_error = re.compile(
    r"connection refused|could not connect|connection to server.*failed|"
    r"password authentication failed|no route to host|timeout expired|"
    r"SSL connection|server closed the connection", re.IGNORECASE
)
restore_error = re.compile(
    r"could not execute query|COPY failed|error returned by PQputCopyData|"
    r"pg_restore: error:|^(ERROR|FATAL):", re.IGNORECASE
)
if connection_error.search(raw):
    category = "database connection"
elif restore_error.search(raw):
    category = "restore object"
else:
    category = "client or archive"

object_types = (
    "MATERIALIZED VIEW DATA", "FOREIGN DATA WRAPPER", "OPERATOR FAMILY",
    "OPERATOR CLASS", "DEFAULT ACL", "SEQUENCE SET", "TABLE DATA",
    "FK CONSTRAINT", "EVENT TRIGGER", "MATERIALIZED VIEW",
    "SEQUENCE OWNED BY", "PUBLICATION TABLE", "SUBSCRIPTION TABLE",
    "TABLE ATTACH", "BLOB COMMENTS", "BLOB DATA",
    "USER MAPPING", "CONSTRAINT", "EXTENSION", "FUNCTION", "PROCEDURE",
    "AGGREGATE", "COLLATION", "CONVERSION", "DOMAIN", "FOREIGN TABLE",
    "OPERATOR", "POLICY", "PUBLICATION", "STATISTICS", "SUBSCRIPTION",
    "TRANSFORM", "TRIGGER", "TYPE", "VIEW", "INDEX", "RULE", "SCHEMA",
    "SEQUENCE", "SERVER", "TABLE", "ACL", "COMMENT",
)
post_data = {
    "ACL", "COMMENT", "CONSTRAINT", "DEFAULT ACL", "FK CONSTRAINT",
    "INDEX", "POLICY", "PUBLICATION TABLE", "RULE", "SEQUENCE OWNED BY",
    "STATISTICS", "SUBSCRIPTION TABLE", "TABLE ATTACH", "TRIGGER",
}
data_objects = {
    "BLOB COMMENTS", "BLOB DATA", "MATERIALIZED VIEW DATA",
    "SEQUENCE SET", "TABLE DATA",
}
context = None
last_operation = None
last_object_type = None
for line in raw.splitlines():
    match = re.match(r"^pg_restore: (creating|dropping) (.+?) \"", line)
    if match:
        operation, description = match.groups()
        object_type = next(
            (kind for kind in object_types if description == kind or description.startswith(kind + " ")),
            None,
        )
        last_operation = operation
        last_object_type = object_type
        phase = (
            "cleanup" if operation == "dropping"
            else "post-data" if object_type in post_data
            else "data" if object_type in data_objects
            else "pre-data" if object_type
            else "unknown"
        )
        context = f"phase={phase} operation={operation} object_type={object_type or 'unknown'}"
    elif re.match(r"^pg_restore: processing data for table ", line):
        context = "phase=data operation=processing object_type=TABLE DATA"
        last_operation = "processing"
        last_object_type = "TABLE DATA"
    else:
        toc_entry = re.match(
            r"^pg_restore: from TOC entry \d+;\s+\d+\s+\d+\s+(.+)$", line
        )
        if toc_entry:
            description = toc_entry.group(1)
            object_type = next(
                (kind for kind in object_types if description == kind or description.startswith(kind + " ")),
                None,
            )
            if object_type:
                operation = (
                    last_operation
                    if last_object_type == object_type and last_operation in {"creating", "dropping"}
                    else "unknown"
                )
                phase = (
                    "cleanup" if operation == "dropping"
                    else "data" if object_type in data_objects
                    else "post-data" if object_type in post_data
                    else "pre-data" if operation == "creating"
                    else "unknown"
                )
                context = f"phase={phase} operation={operation} object_type={object_type}"
            else:
                context = "phase=unknown operation=unknown object_type=unknown"

print(f"Disposable restore command failed ({category}; exit code {sys.argv[2]}).", file=sys.stderr)
if context:
    print(f"Restore context: {context}", file=sys.stderr)
shown = 0
for line in raw.splitlines():
    if re.match(r"^(DETAIL|CONTEXT|STATEMENT):|^Command was:|^COPY ", line, re.IGNORECASE):
        continue
    if not re.match(r"^(pg_restore: error:|pg_restore: warning:|ERROR:|FATAL:|psql: error:)", line):
        continue
    safe = re.sub(r"[A-Za-z][A-Za-z0-9.+-]*://[^\s\"']+", "<redacted URL>", line)
    safe = re.sub(
        r"((?:password|PGPASSWORD|token|secret)[=:]\s*)[^\s,;]+",
        r"\1<redacted>", safe, flags=re.IGNORECASE
    )
    safe = re.sub(r"'[^']*'|\"[^\"]*\"", "<redacted value>", safe)
    safe = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", safe)[:300]
    print(f"Sanitized restore stderr: {safe}", file=sys.stderr)
    shown += 1
    if shown == 4:
        break
if shown == 0:
    print("Sanitized pg_restore stderr: no safe diagnostic line was available.", file=sys.stderr)
PY
}

RESTORE_ERROR_LOG="$WORK_DIR/restore.stderr"
if docker run --rm --network host --env-file "$WORK_DIR/local-db.env" \
  -v "$WORK_DIR:/backup:ro" "$PG_IMAGE" \
  pg_restore --verbose --exit-on-error --clean --if-exists --no-owner \
    -h 127.0.0.1 -p "$LOCAL_DB_PORT" -U postgres -d postgres \
    /backup/restore.dump >"$RESTORE_ERROR_LOG" 2>&1; then
  :
else
  RESTORE_EXIT=$?
  print_local_restore_failure "$RESTORE_ERROR_LOG" "$RESTORE_EXIT"
  fail "restore into the local disposable database failed"
fi

docker run --rm --network host \
  -e STAGING_DATABASE_URL -e PGSSLMODE=verify-full \
  -e PGSSLROOTCERT=/certs/supabase-root.crt \
  -v "$CA_PATH:/certs/supabase-root.crt:ro" \
  -v "$WORK_DIR:/compare" "$PG_IMAGE" sh -ec '
    pg_dump "$STAGING_DATABASE_URL" --schema-only --schema=public --no-owner --no-acl \
      | sed -E "/^-- Dumped (from|by) /d" >/compare/staging-schema.sql
  ' >/dev/null 2>&1 || fail "staging schema comparison snapshot failed"
docker run --rm --network host --env-file "$WORK_DIR/local-db.env" \
  -v "$WORK_DIR:/compare" "$PG_IMAGE" sh -ec '
    pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres \
      --schema-only --schema=public --no-owner --no-acl \
      | sed -E "/^-- Dumped (from|by) /d" >/compare/local-schema.sql
  ' >/dev/null 2>&1 || fail "local schema comparison snapshot failed"
diff -u "$WORK_DIR/staging-schema.sql" "$WORK_DIR/local-schema.sql" >/dev/null ||
  fail "restored public schema differs from staging"

cat >"$WORK_DIR/counts.sql" <<'SQL'
SELECT 'deal_rooms', count(*) FROM public.deal_rooms
UNION ALL SELECT 'deal_analyses', count(*) FROM public.deal_analyses
UNION ALL SELECT 'party_submissions', count(*) FROM public.party_submissions
UNION ALL SELECT 'deal_room_tasks', count(*) FROM public.deal_room_tasks
UNION ALL SELECT 'deal_room_invites', count(*) FROM public.deal_room_invites
UNION ALL SELECT 'deal_room_access_sessions', count(*) FROM public.deal_room_access_sessions
UNION ALL SELECT 'custom_workflow_packs', count(*) FROM public.custom_workflow_packs
UNION ALL SELECT 'transaction_record_fields', count(*) FROM public.transaction_record_fields
UNION ALL SELECT 'transaction_record_approvals', count(*) FROM public.transaction_record_approvals
UNION ALL SELECT 'transaction_record_history', count(*) FROM public.transaction_record_history
UNION ALL SELECT 'transaction_record_conflicts', count(*) FROM public.transaction_record_conflicts
UNION ALL SELECT 'deal_events', count(*) FROM public.deal_events
UNION ALL SELECT 'transaction_generation_sessions', count(*) FROM public.transaction_generation_sessions
UNION ALL SELECT 'transaction_generation_sources', count(*) FROM public.transaction_generation_sources
UNION ALL SELECT 'deal_room_owner_sessions', count(*) FROM public.deal_room_owner_sessions
UNION ALL SELECT 'deal_room_owner_exchanges', count(*) FROM public.deal_room_owner_exchanges
UNION ALL SELECT 'transaction_record_party_relationships', count(*) FROM public.transaction_record_party_relationships
UNION ALL SELECT 'transaction_record_party_relationship_history', count(*) FROM public.transaction_record_party_relationship_history
UNION ALL SELECT 'participant_submission_events', count(*) FROM public.participant_submission_events
UNION ALL SELECT 'verified_asset_snapshots', count(*) FROM public.verified_asset_snapshots
ORDER BY 1;
SQL
docker run --rm --network host \
  -e STAGING_DATABASE_URL -e PGSSLMODE=verify-full \
  -e PGSSLROOTCERT=/certs/supabase-root.crt \
  -v "$CA_PATH:/certs/supabase-root.crt:ro" \
  -v "$WORK_DIR:/compare" "$PG_IMAGE" sh -ec '
    psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -AtF "|" -f /compare/counts.sql \
      >/compare/staging-counts.txt 2>/dev/null
  ' || fail "staging row-count comparison failed"
docker run --rm --network host --env-file "$WORK_DIR/local-db.env" \
  -v "$WORK_DIR:/compare" "$PG_IMAGE" sh -ec '
    psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -X -v ON_ERROR_STOP=1 -AtF "|" \
      -f /compare/counts.sql >/compare/local-counts.txt 2>/dev/null
  ' || fail "local row-count comparison failed"
diff -u "$WORK_DIR/staging-counts.txt" "$WORK_DIR/local-counts.txt" >/dev/null ||
  fail "restored row counts differ from staging"

echo "Staging public-schema backup restored and verified; no migration was applied."
