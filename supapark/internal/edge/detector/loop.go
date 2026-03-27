package detector

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/aldoradiputra/supapark/internal/edge/alpr"
	"github.com/aldoradiputra/supapark/internal/edge/gate"
	"github.com/aldoradiputra/supapark/internal/edge/pwa"
	"github.com/aldoradiputra/supapark/internal/edge/session"
	syncpkg "github.com/aldoradiputra/supapark/internal/edge/sync"
)

// Loop is the main vehicle detection loop that ties together ALPR, gate
// control, session storage, and cloud communication.
type Loop struct {
	cfg        Config
	alpr       *alpr.Pipeline
	gate       gate.Gate
	store      *session.Store
	sync       *syncpkg.Engine
	sse        *pwa.SSEBroker
	httpClient *http.Client
	logger     *slog.Logger
}

// Config holds the loop configuration.
type Config struct {
	LaneMode   string // "entry" or "exit"
	LaneID     string
	LocationID string
	CloudURL   string
	APIKey     string
	PollInterval time.Duration
}

// NewLoop creates a detector loop.
func NewLoop(
	cfg Config,
	pipeline *alpr.Pipeline,
	g gate.Gate,
	store *session.Store,
	syncEngine *syncpkg.Engine,
	sse *pwa.SSEBroker,
	logger *slog.Logger,
) *Loop {
	return &Loop{
		cfg:    cfg,
		alpr:   pipeline,
		gate:   g,
		store:  store,
		sync:   syncEngine,
		sse:    sse,
		httpClient: &http.Client{Timeout: 10 * time.Second},
		logger: logger.With("component", "detector"),
	}
}

// Run starts the detection loop. It blocks until ctx is cancelled.
func (l *Loop) Run(ctx context.Context) {
	l.logger.Info("detector loop started", "mode", l.cfg.LaneMode, "interval", l.cfg.PollInterval)

	ticker := time.NewTicker(l.cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			l.logger.Info("detector loop stopped")
			return
		case <-ticker.C:
			l.detect(ctx)
		}
	}
}

func (l *Loop) detect(ctx context.Context) {
	result, err := l.alpr.Recognize(ctx)
	if err != nil {
		l.logger.Debug("no plate detected", "err", err)
		return
	}

	plate := normalizePlate(result.Plate)
	l.logger.Info("plate detected", "plate", plate, "type", result.VehicleType, "confidence", result.Confidence)

	switch l.cfg.LaneMode {
	case "entry":
		l.handleEntry(ctx, plate, result)
	case "exit":
		l.handleExit(ctx, plate, result)
	}
}

func (l *Loop) handleEntry(ctx context.Context, plate string, result *alpr.PlateResult) {
	// Try cloud first
	if l.sync.IsOnline() {
		if err := l.cloudEntry(ctx, plate, result); err != nil {
			l.logger.Warn("cloud entry failed, falling back to local", "err", err)
			l.localEntry(ctx, plate, result)
		}
	} else {
		l.localEntry(ctx, plate, result)
	}

	// Always open gate on entry
	if err := l.gate.Open(ctx); err != nil {
		l.logger.Error("gate open failed", "err", err)
	}
}

func (l *Loop) handleExit(ctx context.Context, plate string, result *alpr.PlateResult) {
	l.sse.Broadcast(pwa.Event{Type: "detecting", Plate: plate})

	if l.sync.IsOnline() {
		l.cloudExit(ctx, plate, result)
	} else {
		l.localExit(ctx, plate, result)
	}
}

func (l *Loop) cloudEntry(ctx context.Context, plate string, result *alpr.PlateResult) error {
	body, _ := json.Marshal(map[string]interface{}{
		"location_id":  l.cfg.LocationID,
		"lane_id":      l.cfg.LaneID,
		"plate":        plate,
		"vehicle_type": result.VehicleType,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, l.cfg.CloudURL+"/api/v1/sessions/entry", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", l.cfg.APIKey)

	resp, err := l.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("cloud entry returned %d", resp.StatusCode)
	}

	l.logger.Info("cloud entry reported", "plate", plate)
	return nil
}

func (l *Loop) localEntry(ctx context.Context, plate string, result *alpr.PlateResult) {
	sess := &session.EdgeSession{
		ID:            uuid.New().String(),
		Plate:         plate,
		VehicleType:   result.VehicleType,
		EntryTime:     time.Now(),
		PaymentStatus: "none",
		Synced:        false,
	}

	if err := l.store.SaveSession(sess); err != nil {
		l.logger.Error("save local entry", "err", err)
	} else {
		l.logger.Info("local entry saved", "plate", plate, "id", sess.ID)
	}
}

func (l *Loop) cloudExit(ctx context.Context, plate string, result *alpr.PlateResult) {
	// Look up active session from cloud
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf("%s/api/v1/vehicles/%s/session", l.cfg.CloudURL, plate), nil)
	if err != nil {
		l.logger.Error("build session lookup request", "err", err)
		l.localExit(ctx, plate, result)
		return
	}

	resp, err := l.httpClient.Do(req)
	if err != nil {
		l.logger.Warn("cloud session lookup failed", "err", err)
		l.localExit(ctx, plate, result)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		l.logger.Info("no active session found for plate", "plate", plate)
		l.sse.Broadcast(pwa.Event{Type: "error", Plate: plate, Message: "Sesi tidak ditemukan"})
		return
	}

	var sessionResp struct {
		ID            string `json:"id"`
		IsMember      bool   `json:"is_member"`
		TariffAmount  *int   `json:"tariff_amount"`
		PaymentStatus string `json:"payment_status"`
	}
	json.NewDecoder(resp.Body).Decode(&sessionResp)

	// Report exit to cloud
	exitBody, _ := json.Marshal(map[string]interface{}{
		"session_id": sessionResp.ID,
		"lane_id":    l.cfg.LaneID,
		"plate":      plate,
	})

	exitReq, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		l.cfg.CloudURL+"/api/v1/sessions/exit", bytes.NewReader(exitBody))
	exitReq.Header.Set("Content-Type", "application/json")
	exitReq.Header.Set("X-API-Key", l.cfg.APIKey)

	exitResp, err := l.httpClient.Do(exitReq)
	if err != nil {
		l.logger.Warn("cloud exit failed", "err", err)
		return
	}
	defer exitResp.Body.Close()

	var exitData struct {
		IsMember      bool   `json:"is_member"`
		TariffAmount  int    `json:"tariff_amount"`
		PaymentStatus string `json:"payment_status"`
	}
	json.NewDecoder(exitResp.Body).Decode(&exitData)

	// If member or already paid → open gate
	if exitData.IsMember || exitData.PaymentStatus == "paid" {
		l.sse.Broadcast(pwa.Event{
			Type:  "success",
			Plate: plate,
			Fee:   exitData.TariffAmount,
		})
		l.gate.Open(ctx)
		return
	}

	// Otherwise show payment screen
	l.sse.Broadcast(pwa.Event{
		Type:      "payment",
		Plate:     plate,
		Fee:       exitData.TariffAmount,
		SessionID: sessionResp.ID,
	})

	// Request QRIS
	qrisBody, _ := json.Marshal(map[string]interface{}{
		"session_id": sessionResp.ID,
		"amount":     exitData.TariffAmount,
	})

	qrisReq, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		l.cfg.CloudURL+"/api/v1/payments/qris/create", bytes.NewReader(qrisBody))
	qrisReq.Header.Set("Content-Type", "application/json")
	qrisReq.Header.Set("X-API-Key", l.cfg.APIKey)

	qrisResp, err := l.httpClient.Do(qrisReq)
	if err != nil {
		l.logger.Error("create QRIS failed", "err", err)
		return
	}
	defer qrisResp.Body.Close()

	var qrisData struct {
		QRString string `json:"qr_string"`
	}
	json.NewDecoder(qrisResp.Body).Decode(&qrisData)

	l.sse.Broadcast(pwa.Event{
		Type:     "qris",
		Plate:    plate,
		Fee:      exitData.TariffAmount,
		QRString: qrisData.QRString,
	})
}

func (l *Loop) localExit(ctx context.Context, plate string, _ *alpr.PlateResult) {
	sess, err := l.store.FindActiveByPlate(plate)
	if err != nil {
		l.logger.Info("no local session for plate", "plate", plate, "err", err)
		l.sse.Broadcast(pwa.Event{Type: "error", Plate: plate, Message: "Sesi tidak ditemukan"})
		return
	}

	now := time.Now()
	sess.ExitTime = &now
	// Simple local tariff: Rp 5000/hour for cars, Rp 2000/hour for motorcycles
	duration := now.Sub(sess.EntryTime)
	hours := int(duration.Hours()) + 1
	if sess.VehicleType == "motorcycle" {
		sess.Fee = hours * 2000
	} else {
		sess.Fee = hours * 5000
	}
	sess.PaymentStatus = "pending"

	if err := l.store.SaveSession(sess); err != nil {
		l.logger.Error("save local exit", "err", err)
	}

	l.sse.Broadcast(pwa.Event{
		Type:      "payment",
		Plate:     plate,
		Fee:       sess.Fee,
		SessionID: sess.ID,
		Message:   "Offline mode - bayar di kasir",
	})

	// In offline mode, open gate after showing fee (operator handles payment)
	time.AfterFunc(10*time.Second, func() {
		l.gate.Open(ctx)
	})
}

func normalizePlate(plate string) string {
	plate = strings.ToUpper(plate)
	plate = strings.ReplaceAll(plate, " ", "")
	plate = strings.ReplaceAll(plate, "-", "")
	return plate
}
