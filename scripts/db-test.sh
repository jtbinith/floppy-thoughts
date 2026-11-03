#!/usr/bin/env bash
# Runs the database's access tests (supabase/tests) against a throwaway copy of Supabase's Postgres.
# The container publishes no ports: the tests run inside it, so nothing is reachable from outside.
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=public.ecr.aws/supabase/postgres:17.11.0.011
NAME=floppy-db-test
docker rm -f "$NAME" >/dev/null 2>&1 || true
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$(head -c 18 /dev/urandom | base64)" "$IMAGE" >/dev/null
until docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1; do sleep 1; done
sleep 2
docker cp supabase/. "$NAME":/work >/dev/null
psql() { docker exec -i "$NAME" psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
for f in supabase/migrations/*.sql; do psql -f "/work/${f#supabase/}" >/dev/null; done
status=0
for f in supabase/tests/*.sql; do
  out=$(psql -X -t -A -f "/work/${f#supabase/}" 2>&1) || status=1
  echo "$out" | grep -E "^(not ok|# )|ERROR|DETAIL|LINE" || true
  echo "$f: $(echo "$out" | grep -c '^ok') passed, $(echo "$out" | grep -c '^not ok') failed"
  echo "$out" | grep -q '^not ok\|Looks like\|ERROR' && status=1
done
exit $status
