package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dxfrontier/kyverno-dashboard/internal/cache"
	"github.com/dxfrontier/kyverno-dashboard/internal/config"
	"github.com/dxfrontier/kyverno-dashboard/internal/handler"
	"github.com/dxfrontier/kyverno-dashboard/internal/middleware"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := config.Load()

	// Build K8s client config: in-cluster first, fall back to kubeconfig
	k8sCfg, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			home, _ := os.UserHomeDir()
			kubeconfig = home + "/.kube/config"
		}
		k8sCfg, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			slog.Error("failed to build k8s config", "err", err)
			os.Exit(1)
		}
	}

	dynClient, err := dynamic.NewForConfig(k8sCfg)
	if err != nil {
		slog.Error("failed to create dynamic client", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start informers with 5-minute resync
	store := cache.New(ctx, dynClient, cache.KyvernoGVRs, 5*time.Minute)

	slog.Info("waiting for informer sync...")
	if !store.WaitForSync(ctx) {
		slog.Warn("not all informers synced, starting anyway")
	}
	slog.Info("informers synced")

	// Set up routes
	mux := http.NewServeMux()
	mux.HandleFunc("/api/policies", handler.PoliciesHandler(store))
	mux.HandleFunc("/api/policies/", handler.PoliciesHandler(store))
	mux.HandleFunc("/api/reports", handler.ReportsHandler(store))
	mux.HandleFunc("/healthz", handler.HealthzHandler())
	mux.HandleFunc("/readyz", handler.ReadyzHandler(store))

	// Middleware chain
	var h http.Handler = mux
	h = middleware.CORS(h)
	h = middleware.Security(h)
	h = middleware.Logging(h)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      h,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		slog.Info("starting server", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-sigCh
	slog.Info("shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	cancel() // stop informers
	slog.Info("server stopped")
}
