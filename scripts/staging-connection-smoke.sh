#!/usr/bin/env bash
set -Eeuo pipefail
set +x

readonly POSTGRES_IMAGE="postgres:17.11-alpine"
readonly CERT_PATH="${GITHUB_WORKSPACE}/ops/staging-runner/supabase-root.crt"
readonly CERT_SHA_PATH="${GITHUB_WORKSPACE}/ops/staging-runner/supabase-root.crt.sha256"

fail() {
  echo "$1" >&2
  exit 1
}

[[ "${GITHUB_REF:-}" == "refs/heads/staging-migrations" ]] ||
  fail "This smoke test only runs from staging-migrations."

: "${STAGING_DATABASE_URL:?Missing environment-scoped STAGING_DATABASE_URL}"

[[ -s "$CERT_PATH" ]] || fail "The verified staging Supabase CA file is missing."
[[ -s "$CERT_SHA_PATH" ]] || fail "The independently verified CA SHA-256 pin is missing."

openssl x509 -in "$CERT_PATH" -noout >/dev/null 2>&1 ||
  fail "The configured CA file is not a readable X.509 certificate."
openssl x509 -in "$CERT_PATH" -noout -ext basicConstraints 2>/dev/null |
  grep -q 'CA:TRUE' ||
  fail "The configured certificate is not marked as a CA certificate."

checksum_line="$(<"$CERT_SHA_PATH")"
[[ "$checksum_line" =~ ^([A-Fa-f0-9]{64})[[:space:]][[:space:]]supabase-root\.crt$ ]] ||
  fail "The CA SHA-256 pin must be a sha256sum line for supabase-root.crt."
expected_cert_sha="${BASH_REMATCH[1]}"
actual_cert_sha="$(sha256sum "$CERT_PATH" | cut -d' ' -f1)"
[[ "${actual_cert_sha,,}" == "${expected_cert_sha,,}" ]] ||
  fail "The CA certificate does not match the reviewed SHA-256 pin."

# Accept exactly one URI option: sslmode=verify-full.
# PGSSLROOTCERT is supplied separately so URI parameters cannot replace it.
python3 - <<'PY'
import os
import sys
from urllib.parse import parse_qsl, urlsplit

uri = os.environ["STAGING_DATABASE_URL"]
try:
    parsed = urlsplit(uri)
    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    port = parsed.port
except (ValueError, TypeError):
    sys.exit("Refusing connection: malformed PostgreSQL URI.")

valid = (
    parsed.scheme in ("postgres", "postgresql")
    and parsed.hostname == "aws-0-us-west-1.pooler.supabase.com"
    and port == 5432
    and parsed.path == "/postgres"
    and parsed.username == "postgres.jpemuoapbgzwapydqiio"
    and bool(parsed.password)
    and not parsed.fragment
    and query == [("sslmode", "verify-full")]
)
if not valid:
    sys.exit("Refusing connection: URI does not match the exact staging Session Pooler settings.")
PY

# The URI is never expanded into the command line or logs. The client enforces
# verify-full and trusts only the reviewed CA mounted at this fixed path.
if ! result="$(
  docker run --rm \
    -e STAGING_DATABASE_URL \
    -e PGSSLMODE=verify-full \
    -e PGSSLROOTCERT=/certs/supabase-root.crt \
    -v "${CERT_PATH}:/certs/supabase-root.crt:ro" \
    "$POSTGRES_IMAGE" \
    sh -ec 'exec psql "$STAGING_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -c "
      SELECT current_database() = '\''postgres'\''
         AND current_user = '\''postgres'\''
         AND EXISTS (
           SELECT 1 FROM pg_stat_ssl
           WHERE pid = pg_backend_pid()
             AND ssl
             AND version IN ('\''TLSv1.2'\'', '\''TLSv1.3'\'')
         )"' 2>/dev/null
)"; then
  fail "Staging connection or TLS certificate verification failed; client output suppressed."
fi

[[ "$result" == "t" ]] ||
  fail "Connected session did not report the expected database and TLS state."

echo "Read-only staging connection smoke test passed; only session metadata was queried."
