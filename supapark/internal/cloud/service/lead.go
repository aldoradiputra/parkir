package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

type LeadRepo interface {
	Create(ctx context.Context, lead *model.Lead) error
	GetByID(ctx context.Context, id string) (*model.Lead, error)
	List(ctx context.Context, status *model.LeadStatus, search string, limit, offset int) ([]model.Lead, int, error)
	Update(ctx context.Context, lead *model.Lead) error
	Delete(ctx context.Context, id string) error
}

type ProjectRepo interface {
	Create(ctx context.Context, project *model.Project) error
	GetByID(ctx context.Context, id string) (*model.Project, error)
	List(ctx context.Context, status *model.ProjectStatus, search string, limit, offset int) ([]model.Project, int, error)
	Update(ctx context.Context, project *model.Project) error
	Delete(ctx context.Context, id string) error
}

type LeadService struct {
	leadRepo    LeadRepo
	projectRepo ProjectRepo
	logger      *slog.Logger
}

func NewLeadService(leadRepo LeadRepo, projectRepo ProjectRepo, logger *slog.Logger) *LeadService {
	return &LeadService{
		leadRepo:    leadRepo,
		projectRepo: projectRepo,
		logger:      logger,
	}
}

func (s *LeadService) CreateLead(ctx context.Context, req dto.CreateLeadRequest) (*model.Lead, error) {
	if req.Name == "" || req.Email == "" || req.Phone == "" || req.FacilityName == "" {
		return nil, errx.BadRequest("name, email, phone, and facility_name are required")
	}

	source := req.Source
	if source == "" {
		source = model.LeadSourceLandingPage
	}

	lead := &model.Lead{
		Name:         req.Name,
		Email:        req.Email,
		Phone:        req.Phone,
		FacilityName: req.FacilityName,
		Source:       source,
		Status:       model.LeadStatusNew,
	}

	if err := s.leadRepo.Create(ctx, lead); err != nil {
		s.logger.Error("failed to create lead", "error", err)
		return nil, fmt.Errorf("create lead: %w", err)
	}

	s.logger.Info("lead created", "id", lead.ID, "email", lead.Email)
	return lead, nil
}

func (s *LeadService) CompleteOnboarding(ctx context.Context, id string, req dto.OnboardLeadRequest) (*model.Lead, error) {
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get lead: %w", err)
	}
	if lead == nil {
		return nil, errx.NotFound("lead not found")
	}

	lead.City = req.City
	lead.Address = req.Address
	lead.Latitude = req.Latitude
	lead.Longitude = req.Longitude
	lead.EntryLanes = req.EntryLanes
	lead.ExitLanes = req.ExitLanes
	lead.CurrentSystem = req.CurrentSystem
	lead.DailyVolume = req.DailyVolume

	if req.PreferredDate != nil {
		t, err := time.Parse("2006-01-02", *req.PreferredDate)
		if err == nil {
			lead.PreferredDate = &t
		}
	}

	now := time.Now()
	lead.OnboardedAt = &now
	if lead.Status == model.LeadStatusNew {
		lead.Status = model.LeadStatusQualified
	}

	if err := s.leadRepo.Update(ctx, lead); err != nil {
		return nil, fmt.Errorf("update lead onboarding: %w", err)
	}

	s.logger.Info("lead onboarded", "id", lead.ID)
	return lead, nil
}

func (s *LeadService) ConvertToProject(ctx context.Context, id string) (*model.Project, error) {
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get lead: %w", err)
	}
	if lead == nil {
		return nil, errx.NotFound("lead not found")
	}
	if lead.Status == model.LeadStatusConverted {
		return nil, errx.Conflict("lead already converted")
	}

	entryLanes := 1
	if lead.EntryLanes != nil {
		entryLanes = *lead.EntryLanes
	}
	exitLanes := 1
	if lead.ExitLanes != nil {
		exitLanes = *lead.ExitLanes
	}

	now := time.Now()
	project := &model.Project{
		LeadID:       &lead.ID,
		FacilityName: lead.FacilityName,
		ContactName:  lead.Name,
		ContactEmail: lead.Email,
		ContactPhone: lead.Phone,
		City:         lead.City,
		Address:      lead.Address,
		Latitude:     lead.Latitude,
		Longitude:    lead.Longitude,
		EntryLanes:   entryLanes,
		ExitLanes:    exitLanes,
		Status:       model.ProjectStatusPlanning,
		StartDate:    &now,
		Notes:        lead.Notes,
	}

	if err := s.projectRepo.Create(ctx, project); err != nil {
		return nil, fmt.Errorf("create project: %w", err)
	}

	lead.Status = model.LeadStatusConverted
	lead.ConvertedAt = &now
	lead.ProjectID = &project.ID
	if err := s.leadRepo.Update(ctx, lead); err != nil {
		s.logger.Error("failed to update lead after conversion", "lead_id", lead.ID, "error", err)
	}

	s.logger.Info("lead converted to project", "lead_id", lead.ID, "project_id", project.ID)
	return project, nil
}

func (s *LeadService) GetLead(ctx context.Context, id string) (*model.Lead, error) {
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get lead: %w", err)
	}
	if lead == nil {
		return nil, errx.NotFound("lead not found")
	}
	return lead, nil
}

func (s *LeadService) ListLeads(ctx context.Context, status *model.LeadStatus, search string, limit, offset int) ([]model.Lead, int, error) {
	return s.leadRepo.List(ctx, status, search, limit, offset)
}

func (s *LeadService) UpdateLead(ctx context.Context, id string, req dto.UpdateLeadRequest) (*model.Lead, error) {
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get lead: %w", err)
	}
	if lead == nil {
		return nil, errx.NotFound("lead not found")
	}

	if req.Status != nil {
		lead.Status = *req.Status
	}
	if req.Notes != nil {
		lead.Notes = req.Notes
	}

	if err := s.leadRepo.Update(ctx, lead); err != nil {
		return nil, fmt.Errorf("update lead: %w", err)
	}
	return lead, nil
}

func (s *LeadService) DeleteLead(ctx context.Context, id string) error {
	return s.leadRepo.Delete(ctx, id)
}

func (s *LeadService) GetProject(ctx context.Context, id string) (*model.Project, error) {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}
	if project == nil {
		return nil, errx.NotFound("project not found")
	}
	return project, nil
}

func (s *LeadService) ListProjects(ctx context.Context, status *model.ProjectStatus, search string, limit, offset int) ([]model.Project, int, error) {
	return s.projectRepo.List(ctx, status, search, limit, offset)
}

func (s *LeadService) UpdateProject(ctx context.Context, id string, req dto.UpdateProjectRequest) (*model.Project, error) {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("get project: %w", err)
	}
	if project == nil {
		return nil, errx.NotFound("project not found")
	}

	if req.Status != nil {
		project.Status = *req.Status
	}
	if req.Notes != nil {
		project.Notes = req.Notes
	}
	if req.StartDate != nil {
		if t, err := time.Parse("2006-01-02", *req.StartDate); err == nil {
			project.StartDate = &t
		}
	}
	if req.TargetLive != nil {
		if t, err := time.Parse("2006-01-02", *req.TargetLive); err == nil {
			project.TargetLive = &t
		}
	}
	if req.ActualLive != nil {
		if t, err := time.Parse("2006-01-02", *req.ActualLive); err == nil {
			project.ActualLive = &t
		}
	}

	if err := s.projectRepo.Update(ctx, project); err != nil {
		return nil, fmt.Errorf("update project: %w", err)
	}
	return project, nil
}

func (s *LeadService) DeleteProject(ctx context.Context, id string) error {
	return s.projectRepo.Delete(ctx, id)
}
