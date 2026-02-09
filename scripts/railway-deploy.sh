#!/bin/sh
# =============================================================================
# Railway deployment helper
#
# Usage:
#   pnpm railway:deploy:ollama            — deploy the Ollama service
#   pnpm railway:deploy:web               — deploy the web service
#
# Prerequisites:
#   - Railway CLI installed and logged in (railway login)
#   - Project linked (railway link)
#
# First-time Ollama setup:
#   After the first deploy, attach a volume at /root/.ollama in the Railway
#   dashboard so models persist across deploys.
#
# NOTE: We intentionally do NOT use railway.toml because both services share
#       the same repo, and railway.toml applies to ALL services equally.
#       Instead, each service is configured via variables + CLI flags.
# =============================================================================
set -eu

command_name="${1:-}"

if [ -z "$command_name" ]; then
  echo "Usage:"
  echo "  sh scripts/railway-deploy.sh ollama [SERVICE_NAME]"
  echo "  sh scripts/railway-deploy.sh web    [SERVICE_NAME]"
  exit 1
fi

# ---------------------------------------------------------------------------
# Deploy the Ollama service
# ---------------------------------------------------------------------------
deploy_ollama() {
  service="${1:-Ollama}"

  echo "==> Linking to Railway service: $service"
  railway service "$service"

  echo "==> Setting variables..."
  railway variables --skip-deploys \
    --set "RAILWAY_DOCKERFILE_PATH=Dockerfile.ollama" \
    --set "OLLAMA_HOST=0.0.0.0:11434" \
    --set "OLLAMA_MODEL=${OLLAMA_MODEL:-mistral:7b}" \
    --set "RAILWAY_HEALTHCHECK_TIMEOUT_SEC=600"

  echo "==> Deploying..."
  railway up -d

  echo ""
  echo "Done! Ollama deploy triggered for service: $service"
  echo ""
  echo "FIRST-TIME SETUP:"
  echo "  1. Attach a volume at /root/.ollama in the Railway dashboard"
  echo "  2. Redeploy after adding the volume"
}

# ---------------------------------------------------------------------------
# Deploy the web service
# ---------------------------------------------------------------------------
deploy_web() {
  service="${1:-web}"

  echo "==> Linking to Railway service: $service"
  railway service "$service"

  # Railway private networking: lowercase service name + .railway.internal
  ollama_url="http://ollama.railway.internal:11434"

  echo "==> Setting variables..."
  railway variables --skip-deploys \
    --set "RAILWAY_DOCKERFILE_PATH=Dockerfile.railway" \
    --set "OLLAMA_URL=$ollama_url" \
    --set "RAILWAY_HEALTHCHECK_TIMEOUT_SEC=300"

  echo "==> Deploying..."
  railway up -d

  echo ""
  echo "Done! Web deploy triggered for service: $service"
  echo "OLLAMA_URL = $ollama_url"
}

# ---------------------------------------------------------------------------
# Command dispatch
# ---------------------------------------------------------------------------
case "$command_name" in
  ollama)
    deploy_ollama "${2:-Ollama}"
    ;;
  web)
    deploy_web "${2:-web}"
    ;;
  *)
    echo "Unknown command: $command_name"
    echo "Expected: ollama | web"
    exit 1
    ;;
esac
