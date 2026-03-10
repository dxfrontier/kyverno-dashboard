package handler

import (
	"net/http"
	"strings"

	"github.com/dxfrontier/kyverno-dashboard/internal/cache"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// listResponse matches the dx-starter ListResponse<T> shape.
type listResponse struct {
	Items []*unstructured.Unstructured `json:"items"`
	Total int                          `json:"total"`
}

// policiesResponse matches the dx-starter listKyvernoPolicies() return type.
type policiesResponse struct {
	Validating listResponse `json:"validating"`
	Generating listResponse `json:"generating"`
	Mutating   listResponse `json:"mutating"`
	Cluster    listResponse `json:"cluster"`
}

func listForGVR(store *cache.Store, gvr schema.GroupVersionResource) listResponse {
	items, err := store.ListAll(gvr)
	if err != nil || items == nil {
		return listResponse{Items: []*unstructured.Unstructured{}, Total: 0}
	}
	return listResponse{Items: items, Total: len(items)}
}

// PoliciesHandler returns a handler for GET /api/policies and GET /api/policies/:name.
func PoliciesHandler(store *cache.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		// Check if a specific policy name is requested: /api/policies/{name}
		path := strings.TrimPrefix(r.URL.Path, "/api/policies")
		path = strings.TrimPrefix(path, "/")

		if path != "" {
			handleGetPolicy(w, store, path)
			return
		}

		// Map GVRs by resource name for easier access
		gvrMap := make(map[string]schema.GroupVersionResource)
		for _, gvr := range cache.KyvernoGVRs {
			gvrMap[gvr.Resource] = gvr
		}

		resp := policiesResponse{
			Validating: listResponse{Items: []*unstructured.Unstructured{}, Total: 0}, // Not available in this Kyverno version
			Generating: listResponse{Items: []*unstructured.Unstructured{}, Total: 0}, // Not available in this Kyverno version
			Mutating:   listResponse{Items: []*unstructured.Unstructured{}, Total: 0}, // Not available in this Kyverno version
			Cluster:    listForGVR(store, gvrMap["clusterpolicies"]),
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func handleGetPolicy(w http.ResponseWriter, store *cache.Store, name string) {
	// Search clusterpolicies GVR for the named policy
	gvrMap := make(map[string]schema.GroupVersionResource)
	for _, gvr := range cache.KyvernoGVRs {
		gvrMap[gvr.Resource] = gvr
	}

	if gvr, ok := gvrMap["clusterpolicies"]; ok {
		obj, err := store.Get(gvr, "", name)
		if err == nil && obj != nil {
			writeJSON(w, http.StatusOK, obj)
			return
		}
	}
	writeError(w, http.StatusNotFound, "policy not found")
}
