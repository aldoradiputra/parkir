FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /cloud ./cmd/cloud

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /cloud /cloud
EXPOSE 8080
CMD ["/cloud"]
