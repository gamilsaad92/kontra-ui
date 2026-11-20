#!/bin/sh
set -eu

api_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
jest_bin="$api_dir/node_modules/.bin/jest"
verifier="$api_dir/testSupport/verifyIsolationConfig.cjs"
safe_path=${PATH:-/usr/bin:/bin}
safe_home=${HOME:-/tmp}
safe_tmp=${TMPDIR:-/tmp}

if [ -n "${NODE_OPTIONS:-}" ]; then
  echo "Run API tests with NODE_OPTIONS unset." >&2
  exit 1
fi

if [ ! -x "$jest_bin" ]; then
  echo "Jest executable is unavailable in the API workspace." >&2
  exit 1
fi

mode=unit
if [ "${1-}" = "--local-postgres" ]; then
  mode=local-postgres
  shift
  if [ "${KONTRA_ALLOW_LOCAL_POSTGRES_INTEGRATION:-}" != "1" ]; then
    echo "Local PostgreSQL integration requires KONTRA_ALLOW_LOCAL_POSTGRES_INTEGRATION=1." >&2
    exit 1
  fi
  if [ "$#" -ne 2 ] || [ "$1" != "--runTestsByPath" ] \
    || [ "$2" != "lib/canonicalStateAtomicity.pg.test.js" ]; then
    echo "Local PostgreSQL mode is restricted to the canonical-state integration suite." >&2
    exit 1
  fi
fi

for arg in "$@"; do
  case "$arg" in
    --config|--config=*|--setupFiles|--setupFiles=*|--setupFilesAfterEnv|--setupFilesAfterEnv=*|\
    --testEnvironment|--testEnvironment=*|--testMatch|--testMatch=*|--testRegex|--testRegex=*|\
    --testPathIgnorePatterns|--testPathIgnorePatterns=*|--globalSetup|--globalSetup=*|\
    --globalTeardown|--globalTeardown=*|--runner|--runner=*)
      echo "Jest isolation configuration cannot be overridden through this runner." >&2
      exit 1
      ;;
  esac
done

env -i PATH="$safe_path" HOME="$safe_home" TMPDIR="$safe_tmp" NODE_ENV=test \
  node "$verifier"

if [ "$mode" = "local-postgres" ]; then
  exec env -i PATH="$safe_path" HOME="$safe_home" TMPDIR="$safe_tmp" \
    NODE_ENV=test KONTRA_TEST_ISOLATION_MODE=local-postgres \
    KONTRA_CANONICAL_ATOMICITY_PG_TEST=1 \
    "$jest_bin" "$@"
fi

exec env -i PATH="$safe_path" HOME="$safe_home" TMPDIR="$safe_tmp" \
  NODE_ENV=test KONTRA_TEST_ISOLATION_MODE=unit \
  "$jest_bin" "$@"
