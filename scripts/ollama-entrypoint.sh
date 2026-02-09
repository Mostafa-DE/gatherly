#!/bin/bash
set -e

MODEL="${OLLAMA_MODEL:-mistral:7b}"

# Start Ollama server in the background
ollama serve &
SERVER_PID=$!

echo "Waiting for Ollama server to start..."

MAX_RETRIES=30
SLEEP_TIME=2

for ((i=1; i<=MAX_RETRIES; i++)); do
  if ollama list > /dev/null 2>&1; then
    echo "Ollama server is ready."
    break
  fi
  echo "Attempt $i/$MAX_RETRIES - retrying in ${SLEEP_TIME}s..."
  sleep $SLEEP_TIME
done

if ! ollama list > /dev/null 2>&1; then
  echo "ERROR: Ollama server did not start in time."
  kill $SERVER_PID 2>/dev/null
  exit 1
fi

# Pull the model if not already present
if ! ollama list | grep -q "$MODEL"; then
  echo "Pulling model: $MODEL ..."
  ollama pull "$MODEL"
  echo "Model $MODEL pulled successfully."
else
  echo "Model $MODEL already present."
fi

echo "Ollama is ready with $MODEL"

# Keep the server running in the foreground
wait $SERVER_PID
