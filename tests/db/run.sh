#!/bin/sh
# Runs the Row Level Security tests on a throwaway local PostgreSQL database.
# Needs a running PostgreSQL 15+ you can connect to as a superuser:
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres npm run test:db
set -e
DB=ourcampus_rls_test
psql -q -c "drop database if exists $DB" -c "create database $DB" postgres
psql -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql $DB
psql -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261117000000_init.sql $DB >/dev/null 2>&1
OUT=$(psql -q -f tests/db/rls.test.sql $DB 2>/dev/null | grep -E '^(PASS|FAIL)')
echo "$OUT"
psql -q -c "drop database $DB" postgres
echo "$OUT" | grep -q '^FAIL' && { echo "Some RLS tests failed"; exit 1; } || echo "All RLS tests passed"
