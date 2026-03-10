# Kyverno Dashboard

A standalone, read-only Kubernetes dashboard for **Kyverno policy visibility**. Gives developers and platform teams a clear view of which policies govern their workloads — with YAML inspection, violation details, and an interactive dependency graph.

![Dashboard Screenshot](docs/screenshot-light.png)

## Features

- **Policy overview** — all ClusterPolicies and Policies grouped by chain category, with severity badges and pass/fail counters
- **YAML inspector** — slide-out drawer showing the full policy YAML with one-click copy
- **Violation drill-down** — expand any policy row to see individual results with resource name, status, message, and timestamp
- **Dependency graph** — interactive DAG visualization showing which resource kinds each policy validates, generates, or mutates (powered by React Flow + dagre)
- **Dark mode** — toggle with system preference detection and `localStorage` persistence
- **Real-time data** — Go backend watches the K8s API via informers (5 min resync), no polling from the browser
- **Zero auth dependency** — read-only ServiceAccount, no user-level authentication required

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Kubernetes API                      │
│  kyverno.io/v1  ·  policies.kyverno.io/v1alpha1     │
│  wgpolicyk8s.io/v1alpha2                             │
└──────────────┬───────────────────────────────────────┘
               │ informers (5 min resync)
┌──────────────▼───────────────────────────────────────┐
│            Go Backend  (port 8080)                    │
│  DynamicSharedInformerFactory → in-memory cache       │
│  REST: /api/policies · /api/reports · /healthz        │
└──────────────┬───────────────────────────────────────┘
               │ reverse proxy /api/
┌──────────────▼───────────────────────────────────────┐
│          nginx  (port 3000)                           │
│  Serves static React SPA + proxies API calls          │
└──────────────┬───────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────┐
│           React SPA                                   │
│  Policy table · Graph view · YAML drawer              │
│  Tailwind v4 · React Flow · dagre                     │
└──────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster with [Kyverno](https://kyverno.io/) installed
- `kubectl` configured with cluster access
- Docker (for building images)

### Local Development

```bash
# Backend — requires a kubeconfig with access to Kyverno CRDs
cd backend && go run ./cmd/kyverno-dashboard

# Frontend — Vite dev server proxies /api to localhost:8080
cd frontend && npm install && npm run dev
```

Open http://localhost:5173.

### Build & Deploy to Cluster

```bash
# Build Docker images
make build

# Deploy to Kubernetes (creates kyverno-dashboard namespace)
make deploy

# Access the dashboard
kubectl port-forward svc/kyverno-dashboard 3000:3000 -n kyverno-dashboard
```

Open http://localhost:3000.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/policies` | All Kyverno policies grouped by type (validating, generating, mutating, cluster) |
| `GET` | `/api/policies/:name` | Single policy by name |
| `GET` | `/api/reports` | All PolicyReports and ClusterPolicyReports |
| `GET` | `/healthz` | Liveness probe |
| `GET` | `/readyz` | Readiness probe — checks informer sync status |

### Response Envelope

All API responses use a consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "code": 200
}
```

## Project Structure

```
kyverno-dashboard/
├── backend/
│   ├── cmd/kyverno-dashboard/     Entry point (main.go)
│   ├── internal/
│   │   ├── cache/                 K8s informer cache (store.go)
│   │   ├── config/                Environment config
│   │   ├── handler/               REST handlers (policies, reports, health)
│   │   └── middleware/            Logging, CORS, security headers
│   ├── Dockerfile                 Multi-stage: golang:1.23-alpine → distroless
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── components/            9 React components (table, graph, drawer, …)
│   │   ├── services/              API client + graph layout engine
│   │   ├── hooks/                 useT() translation hook
│   │   ├── constants/             i18n translations
│   │   └── App.tsx                App shell with dark mode
│   ├── docker/nginx.conf          nginx reverse proxy config
│   ├── Dockerfile                 Multi-stage: node:20-slim → nginx:1.27-alpine-slim
│   ├── vite.config.ts
│   └── package.json
├── deploy/
│   ├── 00-namespace.yaml
│   ├── 01-serviceaccount.yaml
│   ├── 02-clusterrolebinding.yaml
│   ├── 03-clusterrole.yaml
│   ├── 04-service.yaml
│   ├── 05-deployment-backend.yaml
│   ├── 06-deployment-frontend.yaml
│   └── kustomization.yaml
├── Makefile
└── README.md
```

## Supported Policy Formats

The dashboard supports two Kyverno policy formats:

| Format | API Group | Example |
|--------|-----------|---------|
| **Classic v1** | `kyverno.io/v1` | `ClusterPolicy` with `spec.rules[].match.resources.kinds` |
| **CEL-based** | `policies.kyverno.io/v1alpha1` | `ValidatingPolicy`, `GeneratingPolicy`, `MutatingPolicy` with `spec.matchConstraints.resourceRules` |

Both formats are extracted and visualized in the dependency graph.

## Configuration

The backend reads configuration from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP listen port |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `RESYNC_INTERVAL` | `5m` | Informer resync period |

## Security

- **Read-only**: The ServiceAccount has only `get`, `list`, `watch` permissions on Kyverno and PolicyReport CRDs
- **No user auth**: Designed for cluster-internal access (port-forward or internal Ingress)
- **Hardened containers**: `readOnlyRootFilesystem: true`, non-root users, `distroless` base image for backend
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection` set by middleware

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.23, `client-go`, `dynamic informers` |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS v4 |
| Graph | `@xyflow/react` 12, `@dagrejs/dagre` 1 |
| Containers | `distroless/static` (backend), `nginx:1.27-alpine-slim` (frontend) |
| Orchestration | Kubernetes, kustomize |

## License

MIT
