package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/aldoradiputra/supapark/internal/edge/session"
)

// Engine handles background synchronisation of edge sessions to the cloud.
type Engine struct {
	cloudURL   string
	apiKey     string
	store      *session.Store
	online     atomic.Bool
	httpClient *http.Client
	logger     *slog.Logger
}

// NewEngine creates a sync Engine.
func NewEngine(cloudURL, apiKey string, store *session.Store, logger *slog.Logger) *Engine {
	return &Engine{
		cloudURL: cloudURL,
		apiKey:   apiKey,
		store:    store,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger.With("component", "sync"),
	}
}

// IsOnline reports whether the cloud API was reachable on the last check.
func (e *Engine) IsOnline() bool {
	return e.online.Load()
}

// Run starts the background sync loop. It blocks until ctx is cancelled.
func (e *Engine) Run(ctx context.Context, interval time.Duration) {
	e.logger.Info("sync engine started", "interval", interval)

	// Run immediately on start, then on each tick.
	e.tick(ctx)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			e.logger.Info("sync engine stopped")
			return
		case <-ticker.C:
			e.tick(ctx)
		}
	}
}

func (e *Engine) tick(ctx context.Context) {
	if err := e.checkConnectivity(ctx); err != nil {
		e.online.Store(false)
		e.logger.Warn("cloud unreachable", "error", err)
		return
	}
	e.online.Store(true)

	if err := e.PushSessions(ctx); err != nil {
		e.logger.Error("push sessions failed", "error", err)
	}

	if err := e.SendHeartbeat(ctx); err != nil {
		e.logger.Error("heartbeat failed", "error", err)
	}
}

// checkConnectivity performs a GET on the cloud health endpoint.
func (e *Engine) checkConnectivity(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, e.cloudURL+"/api/v1/health", nil)
	if err != nil {
		return fmt.Errorf("build health request: %w", err)
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health check returned %d", resp.StatusCode)
	}
	return nil
}

// PushSessions uploads unsynced sessions to the cloud and marks them as synced.
func (e *Engine) PushSessions(ctx context.Context) error {
	sessions, err := e.store.GetUnsynced(50)
	if err != nil {
		return fmt.Errorf("get unsynced: %w", err)
	}
	if len(sessions) == 0 {
		return nil
	}

	body, err := json.Marshal(sessions)
	if err != nil {
		return fmt.Errorf("marshal sessions: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.cloudURL+"/api/v1/sync/sessions", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build sync request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", e.apiKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("post sessions: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("cloud returned %d on sync", resp.StatusCode)
	}

	ids := make([]string, len(sessions))
	for i, s := range sessions {
		ids[i] = s.ID
	}

	if err := e.store.MarkSynced(ids); err != nil {
		return fmt.Errorf("mark synced: %w", err)
	}

	e.logger.Info("sessions synced", "count", len(ids))
	return nil
}

// heartbeatPayload is the JSON body sent to the cloud heartbeat endpoint.
type heartbeatPayload struct {
	LaneID    string    `json:"lane_id"`
	Timestamp time.Time `json:"timestamp"`
	Online    bool      `json:"online"`
}

// SendHeartbeat posts a heartbeat to the cloud so it knows this edge is alive.
func (e *Engine) SendHeartbeat(ctx context.Context) error {
	payload := heartbeatPayload{
		LaneID:    "", // set by caller via config; we pass apiKey as identifier
		Timestamp: time.Now(),
		Online:    true,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal heartbeat: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, e.cloudURL+"/api/v1/lanes/heartbeat", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build heartbeat request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", e.apiKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send heartbeat: %w", err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("heartbeat returned %d", resp.StatusCode)
	}

	e.logger.Debug("heartbeat sent")
	return nil
}
