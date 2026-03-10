FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /kyverno-dashboard ./cmd/kyverno-dashboard/

FROM gcr.io/distroless/static:nonroot

COPY --from=builder /kyverno-dashboard /kyverno-dashboard

USER 65534:65534
EXPOSE 8080

ENTRYPOINT ["/kyverno-dashboard"]
