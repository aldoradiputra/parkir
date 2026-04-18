package dto

import (
	"time"

	"github.com/aldoradiputra/supapark/pkg/model"
)

// ---------- Requests ----------

type CreateLeadRequest struct {
	Name         string           `json:"name"`
	Email        string           `json:"email"`
	Phone        string           `json:"phone"`
	FacilityName string           `json:"facility_name"`
	Source       model.LeadSource `json:"source,omitempty"`
}

type OnboardLeadRequest struct {
	City          *string              `json:"city"`
	Address       *string              `json:"address"`
	Latitude      *float64             `json:"latitude"`
	Longitude     *float64             `json:"longitude"`
	EntryLanes    *int                 `json:"entry_lanes"`
	ExitLanes     *int                 `json:"exit_lanes"`
	CurrentSystem *model.CurrentSystem `json:"current_system"`
	DailyVolume   *int                 `json:"daily_volume"`
	PreferredDate *string              `json:"preferred_date"`
}

type UpdateLeadRequest struct {
	Status *model.LeadStatus `json:"status,omitempty"`
	Notes  *string           `json:"notes,omitempty"`
}

type UpdateProjectRequest struct {
	Status     *model.ProjectStatus `json:"status,omitempty"`
	StartDate  *string              `json:"start_date,omitempty"`
	TargetLive *string              `json:"target_live,omitempty"`
	ActualLive *string              `json:"actual_live,omitempty"`
	Notes      *string              `json:"notes,omitempty"`
}

// ---------- Responses ----------

type LeadResponse struct {
	ID            string              `json:"id"`
	Name          string              `json:"name"`
	Email         string              `json:"email"`
	Phone         string              `json:"phone"`
	FacilityName  string              `json:"facility_name"`
	Source        model.LeadSource    `json:"source"`
	Status        model.LeadStatus    `json:"status"`
	City          *string             `json:"city,omitempty"`
	Address       *string             `json:"address,omitempty"`
	Latitude      *float64            `json:"latitude,omitempty"`
	Longitude     *float64            `json:"longitude,omitempty"`
	EntryLanes    *int                `json:"entry_lanes,omitempty"`
	ExitLanes     *int                `json:"exit_lanes,omitempty"`
	CurrentSystem *model.CurrentSystem `json:"current_system,omitempty"`
	DailyVolume   *int                `json:"daily_volume,omitempty"`
	PreferredDate *time.Time          `json:"preferred_date,omitempty"`
	Notes         *string             `json:"notes,omitempty"`
	OnboardedAt   *time.Time          `json:"onboarded_at,omitempty"`
	ConvertedAt   *time.Time          `json:"converted_at,omitempty"`
	ProjectID     *string             `json:"project_id,omitempty"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`
}

type ProjectResponse struct {
	ID           string              `json:"id"`
	LeadID       *string             `json:"lead_id,omitempty"`
	LocationID   *string             `json:"location_id,omitempty"`
	FacilityName string              `json:"facility_name"`
	ContactName  string              `json:"contact_name"`
	ContactEmail string              `json:"contact_email"`
	ContactPhone string              `json:"contact_phone"`
	City         *string             `json:"city,omitempty"`
	Address      *string             `json:"address,omitempty"`
	Latitude     *float64            `json:"latitude,omitempty"`
	Longitude    *float64            `json:"longitude,omitempty"`
	EntryLanes   int                 `json:"entry_lanes"`
	ExitLanes    int                 `json:"exit_lanes"`
	Status       model.ProjectStatus `json:"status"`
	StartDate    *time.Time          `json:"start_date,omitempty"`
	TargetLive   *time.Time          `json:"target_live,omitempty"`
	ActualLive   *time.Time          `json:"actual_live,omitempty"`
	Notes        *string             `json:"notes,omitempty"`
	CreatedAt    time.Time           `json:"created_at"`
	UpdatedAt    time.Time           `json:"updated_at"`
}

type LeadListResponse struct {
	Leads []LeadResponse `json:"leads"`
	Total int            `json:"total"`
}

type ProjectListResponse struct {
	Projects []ProjectResponse `json:"projects"`
	Total    int               `json:"total"`
}

type PublicLocationResponse struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Latitude  *float64 `json:"latitude,omitempty"`
	Longitude *float64 `json:"longitude,omitempty"`
}
