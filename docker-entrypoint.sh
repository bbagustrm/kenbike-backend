#!/bin/bash
# ============================================
# DOCKER ENTRYPOINT SCRIPT
# ============================================
# Automatically runs Prisma migrations before starting the app
# Location: /docker-entrypoint.sh (root project)
# ============================================

set -e

echo "============================================"
echo "🚀 Kenbike Backend - Docker Entrypoint"
echo "============================================"

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL to be ready..."

  # Extract connection details from DATABASE_URL
  # Format: postgresql://user:pass@host:port/db
  DB_HOST=$(echo $DATABASE_URL | cut -d'@' -f2 | cut -d':' -f1)
  DB_PORT=$(echo $DATABASE_URL | cut -d':' -f4 | cut -d'/' -f1)

  echo "   Host: $DB_HOST"
  echo "   Port: $DB_PORT"

  # Initial delay to allow PostgreSQL to complete initialization
  sleep 3

  local max_attempts=30
  local attempt=1

  # Use nc (netcat) instead of pg_isready (which is not available in node:alpine)
  until nc -z "$DB_HOST" "$DB_PORT" > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
      echo "   ❌ PostgreSQL failed to become ready after $max_attempts attempts"
      exit 1
    fi

    echo "   ⏳ PostgreSQL is unavailable - retrying in 2 seconds... (attempt $attempt/$max_attempts)"
    sleep 2
    attempt=$((attempt + 1))
  done

  echo "✅ PostgreSQL is ready!"
}

# Function to wait for Redis to be ready
wait_for_redis() {
  echo "⏳ Waiting for Redis to be ready..."

  # Use default values if env vars are not set
  local REDIS_HOST_VAL=${REDIS_HOST:-redis}
  local REDIS_PORT_VAL=${REDIS_PORT:-6379}

  echo "   Host: $REDIS_HOST_VAL"
  echo "   Port: $REDIS_PORT_VAL"

  local max_attempts=30
  local attempt=1

  # Use nc (netcat) instead of redis-cli (might not be available)
  until nc -z "$REDIS_HOST_VAL" "$REDIS_PORT_VAL" > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
      echo "   ❌ Redis failed to become ready after $max_attempts attempts"
      exit 1
    fi

    echo "   ⏳ Redis is unavailable - retrying in 2 seconds... (attempt $attempt/$max_attempts)"
    sleep 2
    attempt=$((attempt + 1))
  done

  echo "✅ Redis is ready!"
}

# Wait for services
wait_for_postgres
wait_for_redis

# Run Prisma migrations
echo "============================================"
echo "📦 Running Prisma Migrations..."
echo "============================================"

if [ "$NODE_ENV" = "production" ]; then
  echo "🔧 Production mode: Running deploy migration..."
  npx prisma migrate deploy
else
  echo "🔧 Development mode: Running dev migration..."
  npx prisma migrate dev --skip-seed || echo "⚠️  Migration failed, continuing..."
fi

echo "✅ Migrations completed!"

# Generate Prisma Client (in case schema changed)
echo "============================================"
echo "🔨 Generating Prisma Client..."
echo "============================================"
npx prisma generate
echo "✅ Prisma Client generated!"

# Seed database (only in development)
if [ "$NODE_ENV" != "production" ]; then
  echo "============================================"
  echo "🌱 Seeding database (development only)..."
  echo "============================================"
  npx prisma db seed || echo "⚠️  No seed script found or seed failed"
fi

echo "============================================"
echo "🎉 Initialization Complete!"
echo "🚀 Starting application..."
echo "============================================"

# Execute the main command (CMD from Dockerfile)
exec "$@"