#!/bin/bash
# ============================================
# PostgreSQL Initialization Script
# ============================================
# This script runs automatically when PostgreSQL container starts
# Location: /scripts/init-db.sh
# ============================================

set -e

echo "============================================"
echo "🗄️  Initializing PostgreSQL Extensions"
echo "============================================"

# Enable pg_stat_statements extension for query tracking
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create extension for query statistics
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

    -- Verify extension is installed
    SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_stat_statements';

    -- Grant necessary permissions
    GRANT pg_read_all_stats TO $POSTGRES_USER;
EOSQL

echo "✅ pg_stat_statements extension enabled!"
echo "============================================"