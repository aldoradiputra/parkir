package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

// SyncSessionService defines the operations needed by the sync handler.
type SyncSessionService interface {
	CreateFromEdge(ctx context.Context, sess EdgeSessionPayload) error
}

// SyncNotifier sends deferred payment notifications.
type SyncNotifier interface {
	SendPaymentLink(ctx context.Context, phone, paymentURL string, sessionID string) error
}

// SyncVehicleLookup finds a vehicle's phone by plate.
type SyncVehicleLookup interface {
	FindPhoneByPlate(ctx context.Context, plateNormalized string) (string, error)
}

// EdgeSessionPayload matches the edge EdgeSession struct for sync.
type EdgeSessionPayload struct {
	ID            string     `json:"id"`
	Plate         string     `json:"plate"`
	VehicleType   string     `json:"vehicle_type"`
	EntryTime     time.Time  `json:"entry_time"`
	ExitTime      *time.Time `json:"exit_time,omitempty"`
	Fee           int        `json:"fee,omitempty"`
	PaymentStatus string     `json:"payment_status"`
	NotifyOnSync  bool       `json:"notify_on_sync,omitempty"`
	Phone         string     `json:"phone,omitempty"`
}

// SyncHandler handles bulk session sync from edge devices.
type SyncHandler struct {
	logger *slog.Logger
}

// NewSyncHandler creates a new SyncHandler.
func NewSyncHandler(logger *slog.Logger) *SyncHandler {
	return &SyncHandler{logger: logger}
}

// HandleSessionSync accepts a batch of edge sessions and processes them.
// Sessions with notify_on_sync=true will have deferred notifications logged.
func (h *SyncHandler) HandleSessionSync(w http.ResponseWriter, r *http.Request) {
	var sessions []EdgeSessionPayload
	if err := json.NewDecoder(r.Body).Decode(&sessions); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	synced := 0
	notifications := 0
	debts := 0

	for _, sess := range sessions {
		synced++

		if sess.NotifyOnSync && sess.ExitTime != nil && sess.Fee > 0 {
			if sess.Phone != "" {
				// Has phone: would send notification (stub logs it)
				h.logger.Info("deferred notification queued",
					"edge_session_id", sess.ID,
					"plate", sess.Plate,
					"fee", sess.Fee,
					"phone", sess.Phone,
				)
				notifications++
			} else {
				// No phone: record as historical debt
				h.logger.Info("historical debt recorded",
					"edge_session_id", sess.ID,
					"plate", sess.Plate,
					"fee", sess.Fee,
				)
				debts++
			}
		}
	}

	h.logger.Info("session sync completed",
		"total", synced,
		"notifications", notifications,
		"debts", debts,
	)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"synced":        synced,
		"notifications": notifications,
		"debts":         debts,
	})
}
