#!/bin/bash

echo "🚀 Starting Tweet Pulse Graph System..."

# Start backend in background
echo "📡 Starting backend server..."
cd backend
node server.js &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server is running on port 3001"
else
    echo "❌ Backend server failed to start"
    exit 1
fi

# Start frontend
echo "🌐 Starting frontend development server..."
npm run dev

# Cleanup function
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT
