package gate

import (
	"context"
	"log/slog"
	"sync"
)

// Gate defines the interface for controlling a parking barrier gate.
type Gate interface {
	// Open commands the gate to open.
	Open(ctx context.Context) error
	// Close commands the gate to close.
	Close(ctx context.Context) error
	// State returns the current gate state ("open", "closed", or "unknown").
	State() string
}

// MockGate is a Gate implementation that only logs actions.
// Suitable for development and testing without physical hardware.
type MockGate struct {
	mu     sync.RWMutex
	state  string
	logger *slog.Logger
}

// NewMockGate creates a MockGate in the closed state.
func NewMockGate(logger *slog.Logger) *MockGate {
	return &MockGate{
		state:  "closed",
		logger: logger.With("component", "gate.mock"),
	}
}

// Open simulates opening the barrier gate.
func (g *MockGate) Open(ctx context.Context) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.logger.InfoContext(ctx, "gate opening")
	g.state = "open"
	return nil
}

// Close simulates closing the barrier gate.
func (g *MockGate) Close(ctx context.Context) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.logger.InfoContext(ctx, "gate closing")
	g.state = "closed"
	return nil
}

// State returns the current gate state.
func (g *MockGate) State() string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.state
}
