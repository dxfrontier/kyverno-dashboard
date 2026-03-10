package handler

import (
	"net/http"

	"github.com/dxfrontier/kyverno-dashboard/internal/cache"
)

// HealthzHandler returns 200 OK (liveness probe).
func HealthzHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// ReadyzHandler returns 200 when informers are synced (readiness probe).
func ReadyzHandler(store *cache.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !store.IsSynced() {
			writeError(w, http.StatusServiceUnavailable, "informers not synced")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}
}
