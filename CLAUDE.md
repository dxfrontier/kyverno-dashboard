# Claude Code Guidelines for kyverno-dashboard

## Repository Overview

Kyverno Dashboard is a real-time Kubernetes dashboard for visualizing Kyverno policies and their relationships to cluster resources. It consists of a **Go backend** (REST API aggregating Kubernetes data) and a **React/TypeScript frontend** (interactive graph visualization with React Flow).

## Architecture

```
backend/          Go REST API (k8s client-go)
├── cmd/          Entrypoint (main.go)
├── internal/     Business logic
│   ├── cache/    In-memory K8s resource cache
│   ├── config/   Configuration
│   ├── handler/  HTTP handlers (policies, resources, graph)
│   └── middleware/ CORS, logging
├── go.mod
└── Dockerfile

frontend/         React + TypeScript + Vite
├── src/
│   ├── components/  React components (Graph, Sidebar, etc.)
│   ├── hooks/       Custom React hooks
│   ├── services/    API client
│   ├── constants/   Shared constants
│   ├── App.tsx      Root component
│   └── main.tsx     Entry point
├── package.json
├── vite.config.ts
└── Dockerfile

deploy/           Kubernetes manifests (Kustomize)
├── kustomization.yaml
├── 01-namespace.yaml ... 07-service.yaml
```

## Key GVRs (Group/Version/Resource)

The backend queries these Kubernetes resources:

| Resource | API Group | Use |
|----------|-----------|-----|
| ClusterPolicy | kyverno.io/v1 | Kyverno cluster-wide policies |
| Policy | kyverno.io/v1 | Kyverno namespaced policies |
| ClusterPolicyReport | wgpolicyk8s.io/v1alpha2 | Policy audit results |
| PolicyReport | wgpolicyk8s.io/v1alpha2 | Namespaced policy results |
| AdmissionReport | kyverno.io/v1alpha2 | Admission audit results |

## Development Commands

```bash
# Backend
cd backend && go run ./cmd/kyverno-dashboard/   # Run locally
cd backend && go build ./...                      # Build
cd backend && go test -race ./...                 # Test
cd backend && go fmt ./... && go vet ./...        # Lint

# Frontend
cd frontend && npm install                        # Install deps
cd frontend && npm run dev                        # Dev server (Vite)
cd frontend && npm run build                      # Production build
cd frontend && npm run lint                       # ESLint
cd frontend && npm run format                     # Prettier write
cd frontend && npm run format:check               # Prettier check

# Full stack (via Makefile)
make build          # Docker build both images
make deploy         # kubectl apply -k deploy/
make undeploy       # kubectl delete
make clean          # Remove artifacts

# Demo
./demo.sh           # Full setup: minikube + build + deploy + port-forward
```

## Git Workflow

- PRs target `main`
- Commit message format: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Pre-commit hook runs Prettier on staged files
- CI validates: Go (fmt/vet/build), Frontend (tsc/lint/format/build), Kustomize

## Important Conventions

- **Formatting**: Prettier with single quotes, semicolons, 120 char width, trailing commas
- **Linting**: ESLint flat config with TypeScript + React Hooks plugins
- **Go**: Standard `go fmt` / `go vet` — no external linter
- **Kubernetes manifests**: Kustomize-based, numbered for ordering (01-, 02-, ...)
- **Styling**: Tailwind CSS v4
