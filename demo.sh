#!/usr/bin/env bash
set -euo pipefail

# Kyverno Dashboard — Demo Setup Script
# Starts minikube, builds images, deploys, and opens the dashboard.

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${DASHBOARD_PORT:-3000}"

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${BOLD}▸ $1${NC}"; }

cleanup() {
    if [[ -n "${PF_PID:-}" ]]; then
        kill "$PF_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

# ── Preflight checks ──────────────────────────────────────────────
step "Checking prerequisites"

command -v docker >/dev/null 2>&1 || error "Docker is not installed"
command -v minikube >/dev/null 2>&1 || error "minikube is not installed"
command -v kubectl >/dev/null 2>&1 || error "kubectl is not installed"

docker info >/dev/null 2>&1 || error "Docker daemon is not running — please start Docker Desktop"
info "Docker is running"

# ── Start minikube ────────────────────────────────────────────────
step "Starting minikube"

if minikube status 2>/dev/null | grep -q "host: Running"; then
    info "minikube already running"
else
    minikube start --quiet 2>&1 | tail -2
    info "minikube started"
fi

# ── Build Docker images ──────────────────────────────────────────
step "Building Docker images (into minikube)"

eval $(minikube docker-env)

echo -n "  Backend...  "
docker build -t kyverno-dashboard-backend:latest "$SCRIPT_DIR/backend" --quiet 2>/dev/null
echo "done"

echo -n "  Frontend... "
docker build -t kyverno-dashboard-frontend:latest "$SCRIPT_DIR/frontend" --quiet 2>/dev/null
echo "done"

info "Both images built"

# ── Deploy to cluster ─────────────────────────────────────────────
step "Deploying to Kubernetes"

kubectl apply -k "$SCRIPT_DIR/deploy/" 2>&1 | grep -v "^$" | sed 's/^/  /'

# Wait for rollout
kubectl rollout status deployment/kyverno-dashboard-backend -n kyverno-dashboard --timeout=90s 2>&1 | tail -1 | sed 's/^/  /'
kubectl rollout status deployment/kyverno-dashboard-frontend -n kyverno-dashboard --timeout=90s 2>&1 | tail -1 | sed 's/^/  /'

info "All pods running"
kubectl get pods -n kyverno-dashboard --no-headers | sed 's/^/  /'

# ── Port-forward ──────────────────────────────────────────────────
step "Starting port-forward"

# Kill any existing port-forward
pkill -f "kubectl port-forward.*kyverno-dashboard" 2>/dev/null || true
sleep 1

kubectl port-forward svc/kyverno-dashboard "$PORT":3000 -n kyverno-dashboard >/dev/null 2>&1 &
PF_PID=$!
sleep 2

if curl -s -o /dev/null -w "" "http://localhost:$PORT" 2>/dev/null; then
    info "Dashboard is live"
else
    warn "Port-forward may need a moment — try refreshing"
fi

# ── Open browser ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Kyverno Dashboard: http://localhost:${PORT}${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:$PORT"
fi

echo -e "Press ${BOLD}Ctrl+C${NC} to stop the dashboard."
wait "$PF_PID" 2>/dev/null
