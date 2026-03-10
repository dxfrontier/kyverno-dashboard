package handler

import (
	"net/http"

	"github.com/dxfrontier/kyverno-dashboard/internal/cache"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// reportsResponse matches the dx-starter listAllPolicyReports() return type.
type reportsResponse struct {
	Namespaced listResponse `json:"namespaced"`
	Cluster    listResponse `json:"cluster"`
}

// ReportsHandler returns a handler for GET /api/reports.
func ReportsHandler(store *cache.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		// Map GVRs by resource name for easier access
		gvrMap := make(map[string]schema.GroupVersionResource)
		for _, gvr := range cache.KyvernoGVRs {
			gvrMap[gvr.Resource] = gvr
		}

		resp := reportsResponse{
			Namespaced: listForGVR(store, gvrMap["policyreports"]),
			Cluster:    listForGVR(store, gvrMap["clusterpolicyreports"]),
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
