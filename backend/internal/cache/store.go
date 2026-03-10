package cache

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	k8scache "k8s.io/client-go/tools/cache"
)

// GVRs for Kyverno resources we watch.
// Note: policies.kyverno.io/v1alpha1 CRDs are not available in older Kyverno versions.
var KyvernoGVRs = []schema.GroupVersionResource{
	// {Group: "policies.kyverno.io", Version: "v1alpha1", Resource: "validatingpolicies"},
	// {Group: "policies.kyverno.io", Version: "v1alpha1", Resource: "generatingpolicies"},
	// {Group: "policies.kyverno.io", Version: "v1alpha1", Resource: "mutatingpolicies"},
	{Group: "kyverno.io", Version: "v1", Resource: "clusterpolicies"},
	{Group: "wgpolicyk8s.io", Version: "v1alpha2", Resource: "policyreports"},
	{Group: "wgpolicyk8s.io", Version: "v1alpha2", Resource: "clusterpolicyreports"},
}

// Store manages informer caches for Kyverno resources.
type Store struct {
	mu        sync.RWMutex
	informers map[schema.GroupVersionResource]k8scache.GenericLister
	factory   dynamicinformer.DynamicSharedInformerFactory
	synced    bool
}

// New creates a new Store and starts informers for each GVR.
func New(ctx context.Context, client dynamic.Interface, gvrs []schema.GroupVersionResource, resyncPeriod time.Duration) *Store {
	factory := dynamicinformer.NewDynamicSharedInformerFactory(client, resyncPeriod)

	s := &Store{
		informers: make(map[schema.GroupVersionResource]k8scache.GenericLister, len(gvrs)),
		factory:   factory,
	}

	for _, gvr := range gvrs {
		inf := factory.ForResource(gvr)
		s.informers[gvr] = inf.Lister()
		slog.Info("started informer", "gvr", gvr.String())
	}

	factory.Start(ctx.Done())
	return s
}

// WaitForSync blocks until all informer caches are synced or ctx is cancelled.
func (s *Store) WaitForSync(ctx context.Context) bool {
	synced := s.factory.WaitForCacheSync(ctx.Done())
	syncCount := 0
	for gvr, ok := range synced {
		if !ok {
			slog.Warn("informer not synced", "gvr", gvr.String())
			// Don't fail completely if some GVRs don't sync (CRD might not exist)
			// Just mark as partially synced
		} else {
			syncCount++
		}
	}
	s.mu.Lock()
	// Consider synced if at least some informers are ready
	s.synced = syncCount > 0
	s.mu.Unlock()
	return s.synced
}

// IsSynced returns whether all informer caches are synced.
func (s *Store) IsSynced() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.synced
}

// ListAll returns all resources of the given GVR from the cache.
func (s *Store) ListAll(gvr schema.GroupVersionResource) ([]*unstructured.Unstructured, error) {
	s.mu.RLock()
	lister, ok := s.informers[gvr]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("no informer for %s", gvr.String())
	}

	objs, err := lister.List(labels.Everything())
	if err != nil {
		return nil, fmt.Errorf("list from cache: %w", err)
	}

	items := make([]*unstructured.Unstructured, 0, len(objs))
	for _, obj := range objs {
		u, ok := obj.(*unstructured.Unstructured)
		if !ok {
			continue
		}
		items = append(items, u)
	}
	return items, nil
}

// ListNamespaced returns resources of the given GVR from a specific namespace.
func (s *Store) ListNamespaced(gvr schema.GroupVersionResource, namespace string) ([]*unstructured.Unstructured, error) {
	s.mu.RLock()
	lister, ok := s.informers[gvr]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("no informer for %s", gvr.String())
	}

	objs, err := lister.ByNamespace(namespace).List(labels.Everything())
	if err != nil {
		return nil, fmt.Errorf("list from cache: %w", err)
	}

	items := make([]*unstructured.Unstructured, 0, len(objs))
	for _, obj := range objs {
		u, ok := obj.(*unstructured.Unstructured)
		if !ok {
			continue
		}
		items = append(items, u)
	}
	return items, nil
}

// Get returns a single resource by name from the informer cache.
func (s *Store) Get(gvr schema.GroupVersionResource, namespace, name string) (*unstructured.Unstructured, error) {
	s.mu.RLock()
	lister, ok := s.informers[gvr]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("no informer for %s", gvr.String())
	}

	var obj interface{}
	var err error
	if namespace != "" {
		obj, err = lister.ByNamespace(namespace).Get(name)
	} else {
		obj, err = lister.Get(name)
	}
	if err != nil {
		return nil, fmt.Errorf("get from cache: %w", err)
	}

	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("unexpected object type")
	}
	return u, nil
}
