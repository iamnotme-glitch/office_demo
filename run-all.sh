#!/usr/bin/env sh
set -e

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "Starting application..."
npm start
