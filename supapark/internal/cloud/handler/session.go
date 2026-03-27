package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/aldoradiputra/supapark/internal/cloud/middleware"
	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

type SessionService interface {
	ReportEntry(ctx context.Context, req dto.EntryRequest) (*dto.EntryResponse, error)
	ReportExit(ctx context.Context, req dto.ExitRequest) (*dto.ExitResponse, error)
	List(ctx context.Context, locationID string, limit, offset int) ([]model.ParkingSession, int, error)
}

type SessionHandler struct {
	svc    SessionService
	logger *slog.Logger
}

func NewSessionHandler(svc SessionService, logger *slog.Logger) *SessionHandler {
	return &SessionHandler{svc: svc, logger: logger}
}

func (h *SessionHandler) ReportEntry(w http.ResponseWriter, r *http.Request) {
	var req dto.EntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Fill from lane context if not provided
	if info, ok := r.Context().Value(middleware.LaneInfoKey).(*middleware.LaneInfo); ok {
		if req.LocationID == "" {
			req.LocationID = info.LocationID
		}
		if req.LaneID == "" {
			req.LaneID = info.LaneID
		}
	}

	resp, err := h.svc.ReportEntry(r.Context(), req)
	if err != nil {
		h.logger.Error("report entry", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *SessionHandler) ReportExit(w http.ResponseWriter, r *http.Request) {
	var req dto.ExitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if info, ok := r.Context().Value(middleware.LaneInfoKey).(*middleware.LaneInfo); ok {
		if req.LaneID == "" {
			req.LaneID = info.LaneID
		}
	}

	resp, err := h.svc.ReportExit(r.Context(), req)
	if err != nil {
		h.logger.Error("report exit", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *SessionHandler) List(w http.ResponseWriter, r *http.Request) {
	locationID := r.URL.Query().Get("location_id")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	sessions, total, err := h.svc.List(r.Context(), locationID, limit, offset)
	if err != nil {
		h.logger.Error("list sessions", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	items := make([]dto.SessionResponse, len(sessions))
	for i, s := range sessions {
		items[i] = dto.SessionResponse{
			ID:              s.ID,
			LocationID:      s.LocationID,
			Plate:           s.Plate,
			VehicleType:     s.VehicleType,
			EntryTime:       s.EntryTime,
			ExitTime:        s.ExitTime,
			DurationMinutes: s.DurationMinutes,
			IsMember:        s.IsMember,
			TariffAmount:    s.TariffAmount,
			PaymentMethod:   s.PaymentMethod,
			PaymentStatus:   s.PaymentStatus,
			SessionStatus:   s.SessionStatus,
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": items,
		"total": total,
	})
}
