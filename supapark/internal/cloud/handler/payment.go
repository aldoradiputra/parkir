package handler

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
)

type PaymentService interface {
	CreateQRIS(ctx context.Context, sessionID string, amount int) (*dto.CreateQRISResponse, error)
	ProcessWebhook(ctx context.Context, orderID string, status string, amount int, payload []byte) error
	GetStatus(ctx context.Context, sessionID string) (*dto.PaymentStatusResponse, error)
}

type PaymentHandler struct {
	svc           PaymentService
	webhookSecret string
	logger        *slog.Logger
}

func NewPaymentHandler(svc PaymentService, webhookSecret string, logger *slog.Logger) *PaymentHandler {
	return &PaymentHandler{
		svc:           svc,
		webhookSecret: webhookSecret,
		logger:        logger,
	}
}

func (h *PaymentHandler) CreateQRIS(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateQRISRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.SessionID == "" || req.Amount <= 0 {
		writeError(w, http.StatusBadRequest, "session_id and amount required")
		return
	}

	resp, err := h.svc.CreateQRIS(r.Context(), req.SessionID, req.Amount)
	if err != nil {
		h.logger.Error("create qris", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *PaymentHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	sessionID := chi.URLParam(r, "sessionID")
	if sessionID == "" {
		writeError(w, http.StatusBadRequest, "session_id required")
		return
	}

	resp, err := h.svc.GetStatus(r.Context(), sessionID)
	if err != nil {
		h.logger.Error("get payment status", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *PaymentHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read body")
		return
	}

	var payload struct {
		OrderID string `json:"order_id"`
		Status  string `json:"status"`
		Amount  int    `json:"amount"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid webhook payload")
		return
	}

	if err := h.svc.ProcessWebhook(r.Context(), payload.OrderID, payload.Status, payload.Amount, body); err != nil {
		h.logger.Error("process webhook", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
