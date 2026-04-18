package model

import "time"

// ---------- Lead enums ----------

type LeadStatus string

const (
	LeadStatusNew       LeadStatus = "new"
	LeadStatusContacted LeadStatus = "contacted"
	LeadStatusQualified LeadStatus = "qualified"
	LeadStatusConverted LeadStatus = "converted"
	LeadStatusLost      LeadStatus = "lost"
)

type LeadSource string

const (
	LeadSourceLandingPage  LeadSource = "landing_page"
	LeadSourceReferral     LeadSource = "referral"
	LeadSourceSocialMedia  LeadSource = "social_media"
	LeadSourceDirect       LeadSource = "direct"
	LeadSourceOther        LeadSource = "other"
)

type CurrentSystem string

const (
	CurrentSystemManual   CurrentSystem = "manual"
	CurrentSystemBoomGate CurrentSystem = "boom_gate"
	CurrentSystemTicket   CurrentSystem = "ticket"
	CurrentSystemRFID     CurrentSystem = "rfid"
	CurrentSystemOther    CurrentSystem = "other"
)

// ---------- Project enums ----------

type ProjectStatus string

const (
	ProjectStatusPlanning     ProjectStatus = "planning"
	ProjectStatusProcurement  ProjectStatus = "procurement"
	ProjectStatusInstallation ProjectStatus = "installation"
	ProjectStatusTesting      ProjectStatus = "testing"
	ProjectStatusLive         ProjectStatus = "live"
	ProjectStatusMaintenance  ProjectStatus = "maintenance"
	ProjectStatusCancelled    ProjectStatus = "cancelled"
)

// ---------- Structs ----------

type Lead struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Email         string         `json:"email"`
	Phone         string         `json:"phone"`
	FacilityName  string         `json:"facility_name"`
	Source        LeadSource     `json:"source"`
	Status        LeadStatus     `json:"status"`
	City          *string        `json:"city,omitempty"`
	Address       *string        `json:"address,omitempty"`
	Latitude      *float64       `json:"latitude,omitempty"`
	Longitude     *float64       `json:"longitude,omitempty"`
	EntryLanes    *int           `json:"entry_lanes,omitempty"`
	ExitLanes     *int           `json:"exit_lanes,omitempty"`
	CurrentSystem *CurrentSystem `json:"current_system,omitempty"`
	DailyVolume   *int           `json:"daily_volume,omitempty"`
	PreferredDate *time.Time     `json:"preferred_date,omitempty"`
	Notes         *string        `json:"notes,omitempty"`
	OnboardedAt   *time.Time     `json:"onboarded_at,omitempty"`
	ConvertedAt   *time.Time     `json:"converted_at,omitempty"`
	ProjectID     *string        `json:"project_id,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type Project struct {
	ID           string        `json:"id"`
	LeadID       *string       `json:"lead_id,omitempty"`
	LocationID   *string       `json:"location_id,omitempty"`
	FacilityName string        `json:"facility_name"`
	ContactName  string        `json:"contact_name"`
	ContactEmail string        `json:"contact_email"`
	ContactPhone string        `json:"contact_phone"`
	City         *string       `json:"city,omitempty"`
	Address      *string       `json:"address,omitempty"`
	Latitude     *float64      `json:"latitude,omitempty"`
	Longitude    *float64      `json:"longitude,omitempty"`
	EntryLanes   int           `json:"entry_lanes"`
	ExitLanes    int           `json:"exit_lanes"`
	Status       ProjectStatus `json:"status"`
	StartDate    *time.Time    `json:"start_date,omitempty"`
	TargetLive   *time.Time    `json:"target_live,omitempty"`
	ActualLive   *time.Time    `json:"actual_live,omitempty"`
	Notes        *string       `json:"notes,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}
