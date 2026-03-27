package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

type VehicleRepository interface {
	FindByPlateNormalized(ctx context.Context, plate string) (*model.Vehicle, error)
	LinkPhone(ctx context.Context, plateNormalized, phone string) error
}

type SessionRepository interface {
	FindActiveByPlateAndLocation(ctx context.Context, locationID, plateNormalized string) (*model.ParkingSession, error)
	FindActiveByPlate(ctx context.Context, plateNormalized string) (*model.ParkingSession, error)
}

type VehicleHandler struct {
	vehicleRepo VehicleRepository
	sessionRepo SessionRepository
	paymentSvc  PaymentService
	logger      *slog.Logger
}

func NewVehicleHandler(vehicleRepo VehicleRepository, sessionRepo SessionRepository, paymentSvc PaymentService, logger *slog.Logger) *VehicleHandler {
	return &VehicleHandler{
		vehicleRepo: vehicleRepo,
		sessionRepo: sessionRepo,
		paymentSvc:  paymentSvc,
		logger:      logger,
	}
}

func (h *VehicleHandler) LinkPhone(w http.ResponseWriter, r *http.Request) {
	var req dto.LinkVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Plate == "" || req.Phone == "" {
		writeError(w, http.StatusBadRequest, "plate and phone required")
		return
	}

	plateNorm := normalizePlate(req.Plate)
	if err := h.vehicleRepo.LinkPhone(r.Context(), plateNorm, req.Phone); err != nil {
		h.logger.Error("link phone", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"plate": plateNorm,
		"phone": req.Phone,
		"status": "linked",
	})
}

func (h *VehicleHandler) GetActiveSession(w http.ResponseWriter, r *http.Request) {
	plate := chi.URLParam(r, "plate")
	if plate == "" {
		writeError(w, http.StatusBadRequest, "plate required")
		return
	}

	plateNorm := normalizePlate(plate)
	session, err := h.sessionRepo.FindActiveByPlate(r.Context(), plateNorm)
	if err != nil {
		h.logger.Error("find active session", "err", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if session == nil {
		writeError(w, http.StatusNotFound, "no active session for this plate")
		return
	}

	writeJSON(w, http.StatusOK, dto.SessionResponse{
		ID:              session.ID,
		LocationID:      session.LocationID,
		Plate:           session.Plate,
		VehicleType:     session.VehicleType,
		EntryTime:       session.EntryTime,
		ExitTime:        session.ExitTime,
		DurationMinutes: session.DurationMinutes,
		IsMember:        session.IsMember,
		TariffAmount:    session.TariffAmount,
		PaymentMethod:   session.PaymentMethod,
		PaymentStatus:   session.PaymentStatus,
		SessionStatus:   session.SessionStatus,
	})
}

func (h *VehicleHandler) Prepay(w http.ResponseWriter, r *http.Request) {
	plate := chi.URLParam(r, "plate")
	if plate == "" {
		writeError(w, http.StatusBadRequest, "plate required")
		return
	}

	var req dto.PrepayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp, err := h.paymentSvc.CreateQRIS(r.Context(), req.SessionID, req.Amount)
	if err != nil {
		h.logger.Error("prepay", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func normalizePlate(plate string) string {
	plate = strings.ToUpper(plate)
	plate = strings.ReplaceAll(plate, " ", "")
	plate = strings.ReplaceAll(plate, "-", "")
	return plate
}
