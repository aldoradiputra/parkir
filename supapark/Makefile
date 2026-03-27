.PHONY: build-cloud build-edge build test clean migrate seed

# Build
build-cloud:
	go build -o bin/cloud ./cmd/cloud

build-edge:
	go build -o bin/edge ./cmd/edge

build: build-cloud build-edge

# Cross-compile edge for Raspberry Pi
build-edge-arm:
	GOOS=linux GOARCH=arm64 go build -o bin/edge-arm64 ./cmd/edge

# Test
test:
	go test ./... -v

vet:
	go vet ./...

# Database
migrate-up:
	migrate -path migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path migrations -database "$(DATABASE_URL)" down 1

# Development
dev-cloud:
	go run ./cmd/cloud

dev-edge:
	EDGE_ALPR_MOCK=true EDGE_RELAY_TYPE=mock go run ./cmd/edge

# Docker
up:
	docker compose up -d

down:
	docker compose down

# Clean
clean:
	rm -rf bin/
