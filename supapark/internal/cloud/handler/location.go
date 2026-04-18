package handler

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

type LocationRepository interface {
	List(ctx context.Context) ([]model.Location, error)
	ListPublic(ctx context.Context) ([]dto.PublicLocationResponse, error)
}

type LocationHandler struct {
	repo   LocationRepository
	logger *slog.Logger
}

func NewLocationHandler(repo LocationRepository, logger *slog.Logger) *LocationHandler {
	return &LocationHandler{repo: repo, logger: logger}
}

func (h *LocationHandler) List(w http.ResponseWriter, r *http.Request) {
	locations, err := h.repo.List(r.Context())
	if err != nil {
		h.logger.Error("list locations", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"items": locations,
	})
}

func (h *LocationHandler) ListPublic(w http.ResponseWriter, r *http.Request) {
	locations, err := h.repo.ListPublic(r.Context())
	if err != nil {
		h.logger.Error("list public locations", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, locations)
}
