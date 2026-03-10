IMAGE_REPO ?= kyverno-dashboard
BACKEND_IMAGE ?= $(IMAGE_REPO)-backend
FRONTEND_IMAGE ?= $(IMAGE_REPO)-frontend
TAG ?= latest

.PHONY: build build-backend build-frontend test deploy clean

build: build-backend build-frontend

build-backend:
	docker build -t $(BACKEND_IMAGE):$(TAG) backend/

build-frontend:
	docker build -t $(FRONTEND_IMAGE):$(TAG) frontend/

test: test-backend test-frontend

test-backend:
	cd backend && go test -race ./...

test-frontend:
	cd frontend && npm test

dev-backend:
	cd backend && go run ./cmd/kyverno-dashboard/

dev-frontend:
	cd frontend && npm run dev

deploy:
	kubectl apply -k deploy/

undeploy:
	kubectl delete -k deploy/ --ignore-not-found

clean:
	cd backend && rm -rf bin/
	cd frontend && rm -rf dist/ node_modules/
