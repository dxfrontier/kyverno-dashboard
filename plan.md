# Kyverno Dashboard — Implementation Plan

## Overview

Standalone read-only Kyverno policy dashboard running as a separate project in the `kyverno-dashboard` namespace. Two containers: Go backend (informer cache → REST API) and React SPA (nginx reverse proxy).

## Architecture

```
K8s API (kyverno.io, policies.kyverno.io, wgpolicyk8s.io)
    ↓ informers (5min resync)
Go backend (port 8080, in-memory cache)
    ↓ REST: GET /api/policies, /api/policies/:name, /api/reports
nginx (port 3000, reverse proxy /api → backend)
    ↓
React SPA (ported KyvernoPoliciesTab + dependency graph)
```

- **Auth:** K8s ServiceAccount with read-only ClusterRole — no user-level auth
- **Data:** Live cluster API via informers for 6 GVRs
- **Frontend:** 9 ported Kyverno components from dx-starter

## Project Structure

```
kyverno-dashboard/
├── backend/
│   ├── cmd/kyverno-dashboard/main.go
│   ├── internal/
│   │   ├── cache/store.go
│   │   ├── handler/{policies,reports,health,common}.go
│   │   ├── middleware/{logging,security,cors}.go
│   │   └── config/config.go
│   ├── go.mod, go.sum
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/          # 9 ported Kyverno components
│   │   ├── services/api.ts     # fetch wrappers
│   │   ├── services/kyvernoPolicyGraph.ts
│   │   ├── constants/i18n.ts   # Flat EN string map
│   │   ├── hooks/useT.ts       # Simple t(key) hook
│   │   ├── App.tsx
│   │   └── index.html
│   ├── docker/nginx.conf
│   ├── package.json, vite.config.ts, tsconfig.json
│   └── Dockerfile
├── deploy/                      # K8s manifests
├── Makefile
├── README.md
└── plan.md                      # ← this file
```

---

## Implementation Steps — Status

### COMPLETED

#### Step 1: Scaffold project skeleton ✅
- Created full directory structure
- `Makefile` with build/test/dev/deploy targets
- `README.md` with architecture docs

#### Step 2: Go backend — cache layer ✅
- `backend/internal/cache/store.go`
- Ported informer cache pattern from dx-starter
- Hardcoded 6 GVRs:
  - `policies.kyverno.io/v1alpha1`: validatingpolicies, generatingpolicies, mutatingpolicies
  - `kyverno.io/v1`: clusterpolicies
  - `wgpolicyk8s.io/v1alpha2`: policyreports, clusterpolicyreports
- Methods: `ListAll()`, `ListNamespaced()`, `Get()`, `IsSynced()`, `WaitForSync()`

#### Step 3: Go backend — handlers + middleware ✅
- `handler/policies.go`: `GET /api/policies` (returns `{validating, generating, mutating, cluster}` matching dx-starter's `listKyvernoPolicies()` shape), `GET /api/policies/:name` (searches all 4 policy GVRs)
- `handler/reports.go`: `GET /api/reports` (returns `{namespaced, cluster}` matching dx-starter's `listAllPolicyReports()` shape)
- `handler/health.go`: `/healthz` (liveness), `/readyz` (checks `IsSynced()`)
- `handler/common.go`: JSON envelope helpers (`{success, data, error, code}`)
- `middleware/`: logging (method/path/status/duration), security headers, CORS

#### Step 4: Go backend — main.go + Dockerfile ✅
- `cmd/kyverno-dashboard/main.go`: K8s client config (in-cluster + kubeconfig fallback), informer startup with 5min resync, middleware chain, graceful shutdown (SIGTERM/SIGINT → 10s drain)
- `Dockerfile`: multi-stage `golang:1.23-alpine` → `distroless/static:nonroot`
- **Verified:** `go build ./...` passes clean

### IN PROGRESS

#### Step 5: Port frontend components 🔄
- `services/kyvernoPolicyGraph.ts` — ✅ ported unchanged
- `components/KyvernoCrdNode.tsx` — ✅ ported with inlined `LAYER_COLORS` constant (removed LayerLegend import)
- **Remaining 8 components to port:**

| Component | Changes needed |
|-----------|---------------|
| `KyvernoChainGroup.tsx` | Replace `../../../services/api` → `../services/api` |
| `KyvernoDependencyGraph.tsx` | Replace api/graph imports, remove `LAYER_COLORS` import (not used directly) |
| `KyvernoPoliciesTab.tsx` | Replace `listKyvernoPolicies`/`listAllPolicyReports` → new `api.ts`; replace `useLanguage` → `useT` |
| `KyvernoPolicyRow.tsx` | Replace `../../../services/api` → `../services/api` |
| `KyvernoPolicyTable.tsx` | Replace api import + `useLanguage` → `useT` |
| `KyvernoReportDetails.tsx` | Replace api import + `useLanguage` → `useT` |
| `KyvernoSummaryBar.tsx` | Replace `useLanguage` → `useT` |
| `KyvernoYamlDrawer.tsx` | Replace api import + `useLanguage` → `useT` |

**Import mapping for all components:**
- `../../../services/api` → `../services/api`
- `../../../contexts/LanguageContext` → `../hooks/useT` (and `useLanguage()` → `useT()`)
- `../../features/explorer/LayerLegend` → inlined constant (only in KyvernoCrdNode)
- `../../../services/kyvernoPolicyGraph` → `../services/kyvernoPolicyGraph`
- Inter-component imports: `./KyvernoXxx` stays the same

### REMAINING

#### Step 6: Frontend services + hooks
- `services/api.ts`: Types (`KyvernoPolicy`, `PolicyReport`, `PolicyReportResult`, `ChainCategory`, `ListResponse`) + 2 fetch functions (`listKyvernoPolicies()`, `listAllPolicyReports()`) matching dx-starter signatures exactly
- `constants/i18n.ts`: Flat `Record<string, string>` with ~25 kyverno-specific EN translation keys extracted from dx-starter's `translations.ts`
- `hooks/useT.ts`: Simple `useT()` hook returning `{ t: (key: string) => string }` — looks up key in i18n map, returns key as fallback

**API response shapes (must match backend envelope):**
```typescript
interface ApiResponse<T> { success: boolean; data?: T; error?: string }
interface ListResponse<T> { items: T[]; total: number }

// listKyvernoPolicies() returns:
{ validating: ListResponse<KyvernoPolicy>, generating: ..., mutating: ..., cluster: ... }

// listAllPolicyReports() returns:
{ namespaced: ListResponse<PolicyReport>, cluster: ListResponse<PolicyReport> }
```

#### Step 7: App shell + build config
- `App.tsx`: Single-page shell, dark mode toggle (persisted to localStorage), renders `<KyvernoPoliciesTab darkMode={darkMode} />`
- `index.html`: Minimal HTML entry point
- `vite.config.ts`: React plugin, proxy `/api` → `http://localhost:8080` for dev
- `package.json`: Deps: react 18, @xyflow/react, @dagrejs/dagre, tailwindcss 4
- `tsconfig.json`: Standard React/Vite config
- `tailwind.config.js` or CSS import for Tailwind v4

#### Step 8: Frontend Dockerfile + nginx
- `docker/nginx.conf`: `server { listen 3000; location /api { proxy_pass http://backend:8080; } location / { root /usr/share/nginx/html; try_files $uri /index.html; } }`
- `Dockerfile`: multi-stage `node:20-slim` (build) → `nginx:1.27-alpine-slim` (serve)

#### Step 9: K8s deploy manifests
All in `deploy/`:
- `01-namespace.yaml`: `kyverno-dashboard` namespace
- `02-serviceaccount.yaml`: SA in kyverno-dashboard ns
- `03-clusterrole.yaml`: Read-only for 3 API groups (`policies.kyverno.io`, `kyverno.io`, `wgpolicyk8s.io`) — verbs: `get`, `list`, `watch`
- `04-clusterrolebinding.yaml`: Bind SA → ClusterRole
- `05-deployment-backend.yaml`: 1 replica, port 8080, liveness `/healthz`, readiness `/readyz`
- `06-deployment-frontend.yaml`: 1 replica, port 3000
- `07-service.yaml`: ClusterIP exposing frontend port 3000
- `kustomization.yaml`: References all 7 manifests

#### Step 10: Register submodule
- Add `kyverno-dashboard` as git submodule entry in dx-frontier's `.gitmodules`

---

## Key Reference Files (from dx-starter)

| What | Path |
|------|------|
| Informer cache pattern | `dx-starter/src/apps/api/internal/cache/cache.go` |
| Server bootstrap pattern | `dx-starter/src/apps/api/cmd/api/main.go` |
| Kyverno components (9 files) | `dx-starter/src/apps/ui/components/features/kyverno/` |
| Graph layout utility | `dx-starter/src/apps/ui/services/kyvernoPolicyGraph.ts` |
| Translation keys | `dx-starter/src/apps/ui/constants/translations.ts` |
| Frontend Dockerfile pattern | `dx-starter/src/apps/ui/Dockerfile` |
| API types (git history) | `dx-starter:ed2ee15e:src/apps/ui/services/api.ts` |
| LAYER_COLORS constant | `dx-starter/src/apps/ui/components/features/explorer/LayerLegend.ts` → `{ ui: '#22c55e', domain: '#3b82f6', provisioning: '#f97316', managed: '#6b7280' }` |

## Verification Checklist

1. **Backend:** `cd backend && go build ./... && go test -race ./...`
2. **Frontend:** `cd frontend && npm install && npm run build`
3. **Docker:** `make build` — both images build successfully
4. **Local dev:** Backend with kubeconfig → vcluster, `npm run dev` with Vite proxy → policies load in browser
5. **Deploy:** `make deploy` → pods running, `/api/policies` returns data, UI renders policy table + graph
