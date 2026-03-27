package pwa

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
)

// Event represents a server-sent event for the exit screen PWA.
type Event struct {
	Type      string `json:"type"`                // "idle", "scanning", "detecting", "payment", "qris", "success", "member", "offline_exit", "error"
	HasPhone  bool   `json:"has_phone,omitempty"` // used by offline_exit to show notification message
	Plate     string `json:"plate,omitempty"`
	Fee       int    `json:"fee,omitempty"`
	SessionID string `json:"session_id,omitempty"`
	QRString  string `json:"qr_string,omitempty"`
	Message   string `json:"message,omitempty"`
}

// SSEBroker manages Server-Sent Events connections for the exit screen.
type SSEBroker struct {
	mu      sync.RWMutex
	clients map[chan Event]struct{}
	logger  *slog.Logger
}

// NewSSEBroker creates a new SSE broker.
func NewSSEBroker(logger *slog.Logger) *SSEBroker {
	return &SSEBroker{
		clients: make(map[chan Event]struct{}),
		logger:  logger.With("component", "sse"),
	}
}

// Broadcast sends an event to all connected SSE clients.
func (b *SSEBroker) Broadcast(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch := range b.clients {
		select {
		case ch <- event:
		default:
			// Client buffer full, skip
		}
	}

	b.logger.Debug("broadcast event", "type", event.Type, "clients", len(b.clients))
}

// ServeHTTP handles SSE connections from the exit screen PWA.
func (b *SSEBroker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := make(chan Event, 16)

	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()

	defer func() {
		b.mu.Lock()
		delete(b.clients, ch)
		b.mu.Unlock()
		close(ch)
	}()

	b.logger.Info("SSE client connected")

	// Send initial idle event
	data, _ := json.Marshal(Event{Type: "idle"})
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			b.logger.Info("SSE client disconnected")
			return
		case event := <-ch:
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}
