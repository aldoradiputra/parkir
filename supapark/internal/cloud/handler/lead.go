package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

type LeadSvc interface {
	CreateLead(ctx context.Context, req dto.CreateLeadRequest) (*model.Lead, error)
	CompleteOnboarding(ctx context.Context, id string, req dto.OnboardLeadRequest) (*model.Lead, error)
	ConvertToProject(ctx context.Context, id string) (*model.Project, error)
	GetLead(ctx context.Context, id string) (*model.Lead, error)
	ListLeads(ctx context.Context, status *model.LeadStatus, search string, limit, offset int) ([]model.Lead, int, error)
	UpdateLead(ctx context.Context, id string, req dto.UpdateLeadRequest) (*model.Lead, error)
	DeleteLead(ctx context.Context, id string) error
	GetProject(ctx context.Context, id string) (*model.Project, error)
	ListProjects(ctx context.Context, status *model.ProjectStatus, search string, limit, offset int) ([]model.Project, int, error)
	UpdateProject(ctx context.Context, id string, req dto.UpdateProjectRequest) (*model.Project, error)
	DeleteProject(ctx context.Context, id string) error
}

type LeadHandler struct {
	svc    LeadSvc
	logger *slog.Logger
}

func NewLeadHandler(svc LeadSvc, logger *slog.Logger) *LeadHandler {
	return &LeadHandler{svc: svc, logger: logger}
}

// Create handles public lead form submission (Step 1).
func (h *LeadHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateLeadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	lead, err := h.svc.CreateLead(r.Context(), req)
	if err != nil {
		h.logger.Error("create lead", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, leadToResponse(lead))
}

// Onboard handles public onboarding completion (Step 2).
func (h *LeadHandler) Onboard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req dto.OnboardLeadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	lead, err := h.svc.CompleteOnboarding(r.Context(), id, req)
	if err != nil {
		h.logger.Error("onboard lead", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, leadToResponse(lead))
}

// ListLeads handles admin lead listing.
func (h *LeadHandler) ListLeads(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("search")
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var status *model.LeadStatus
	if s := q.Get("status"); s != "" {
		st := model.LeadStatus(s)
		status = &st
	}

	leads, total, err := h.svc.ListLeads(r.Context(), status, search, limit, offset)
	if err != nil {
		h.logger.Error("list leads", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	items := make([]dto.LeadResponse, len(leads))
	for i, l := range leads {
		items[i] = *leadToResponse(&l)
	}

	writeJSON(w, http.StatusOK, dto.LeadListResponse{Leads: items, Total: total})
}

// GetLead handles admin single lead retrieval.
func (h *LeadHandler) GetLead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	lead, err := h.svc.GetLead(r.Context(), id)
	if err != nil {
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, leadToResponse(lead))
}

// UpdateLead handles admin lead status/notes update.
func (h *LeadHandler) UpdateLead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req dto.UpdateLeadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	lead, err := h.svc.UpdateLead(r.Context(), id, req)
	if err != nil {
		h.logger.Error("update lead", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, leadToResponse(lead))
}

// ConvertLead converts a lead to a project.
func (h *LeadHandler) ConvertLead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	project, err := h.svc.ConvertToProject(r.Context(), id)
	if err != nil {
		h.logger.Error("convert lead", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, projectToResponse(project))
}

// DeleteLead handles admin lead deletion.
func (h *LeadHandler) DeleteLead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.svc.DeleteLead(r.Context(), id); err != nil {
		h.logger.Error("delete lead", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ListProjects handles admin project listing.
func (h *LeadHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := q.Get("search")
	limit, _ := strconv.Atoi(q.Get("limit"))
	offset, _ := strconv.Atoi(q.Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	var status *model.ProjectStatus
	if s := q.Get("status"); s != "" {
		st := model.ProjectStatus(s)
		status = &st
	}

	projects, total, err := h.svc.ListProjects(r.Context(), status, search, limit, offset)
	if err != nil {
		h.logger.Error("list projects", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	items := make([]dto.ProjectResponse, len(projects))
	for i, p := range projects {
		items[i] = *projectToResponse(&p)
	}

	writeJSON(w, http.StatusOK, dto.ProjectListResponse{Projects: items, Total: total})
}

// GetProject handles admin single project retrieval.
func (h *LeadHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	project, err := h.svc.GetProject(r.Context(), id)
	if err != nil {
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, projectToResponse(project))
}

// UpdateProject handles admin project update.
func (h *LeadHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req dto.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	project, err := h.svc.UpdateProject(r.Context(), id, req)
	if err != nil {
		h.logger.Error("update project", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	writeJSON(w, http.StatusOK, projectToResponse(project))
}

// DeleteProject handles admin project deletion.
func (h *LeadHandler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := h.svc.DeleteProject(r.Context(), id); err != nil {
		h.logger.Error("delete project", "err", err)
		writeError(w, errx.HTTPStatus(err), err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func leadToResponse(l *model.Lead) *dto.LeadResponse {
	return &dto.LeadResponse{
		ID:            l.ID,
		Name:          l.Name,
		Email:         l.Email,
		Phone:         l.Phone,
		FacilityName:  l.FacilityName,
		Source:        l.Source,
		Status:        l.Status,
		City:          l.City,
		Address:       l.Address,
		Latitude:      l.Latitude,
		Longitude:     l.Longitude,
		EntryLanes:    l.EntryLanes,
		ExitLanes:     l.ExitLanes,
		CurrentSystem: l.CurrentSystem,
		DailyVolume:   l.DailyVolume,
		PreferredDate: l.PreferredDate,
		Notes:         l.Notes,
		OnboardedAt:   l.OnboardedAt,
		ConvertedAt:   l.ConvertedAt,
		ProjectID:     l.ProjectID,
		CreatedAt:     l.CreatedAt,
		UpdatedAt:     l.UpdatedAt,
	}
}

func projectToResponse(p *model.Project) *dto.ProjectResponse {
	return &dto.ProjectResponse{
		ID:           p.ID,
		LeadID:       p.LeadID,
		LocationID:   p.LocationID,
		FacilityName: p.FacilityName,
		ContactName:  p.ContactName,
		ContactEmail: p.ContactEmail,
		ContactPhone: p.ContactPhone,
		City:         p.City,
		Address:      p.Address,
		Latitude:     p.Latitude,
		Longitude:    p.Longitude,
		EntryLanes:   p.EntryLanes,
		ExitLanes:    p.ExitLanes,
		Status:       p.Status,
		StartDate:    p.StartDate,
		TargetLive:   p.TargetLive,
		ActualLive:   p.ActualLive,
		Notes:        p.Notes,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
}
