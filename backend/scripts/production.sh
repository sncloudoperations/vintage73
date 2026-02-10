#!/bin/bash

# Production Startup Script for Linux VPS
echo "Starting Production Hardening Process..."

# 1. Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
    echo "Environment variables loaded."
else
    echo "ERROR: .env file not found!"
    exit 1
fi

# 2. Prisma Safety
echo "Ensuring Prisma Client is up to date..."
npx prisma generate

echo "Running Database Migrations..."
# Standard way to run migrations in production
npx prisma migrate deploy

# 3. Directory Safety
echo "Ensuring uploads directory exists..."
mkdir -p ../frontend/public/uploads

# 4. Start Application
echo "Starting Application with PM2..."
pm2 start server.js --name "inventory-backend"

echo "Production Hardening Sync Complete."
