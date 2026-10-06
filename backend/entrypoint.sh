#!/bin/sh
set -e
# Idempotent: creates the tables and loads the Quran reference data on first start only.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  python -m app.database.seed_quran
fi
exec "$@"
