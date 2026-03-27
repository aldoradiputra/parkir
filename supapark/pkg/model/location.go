package model

import "time"

// ---------- Lane enums ----------

type LaneType string

const (
	LaneTypeEntry LaneType = "entry"
	LaneTypeExit  LaneType = "exit"
)

type LaneStatus string

const (
	LaneStatusActive   LaneStatus = "active"
	LaneStatusInactive LaneStatus = "inactive"
)

// ---------- Structs ----------

type Location struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address,omitempty"`
	Timezone  string    `json:"timezone"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Lane struct {
	ID         string     `json:"id"`
	LocationID string     `json:"location_id"`
	Name       string     `json:"name"`
	LaneType   LaneType   `json:"lane_type"`
	Status     LaneStatus `json:"status"`
	CameraURL  *string    `json:"camera_url,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type Member struct {
	ID         string     `json:"id"`
	LocationID string     `json:"location_id"`
	VehicleID  string     `json:"vehicle_id"`
	StartDate  time.Time  `json:"start_date"`
	EndDate    time.Time  `json:"end_date"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type PlateRule struct {
	ID          string      `json:"id"`
	LocationID  string      `json:"location_id"`
	Pattern     string      `json:"pattern"`
	VehicleType VehicleType `json:"vehicle_type"`
	Priority    int         `json:"priority"`
	CreatedAt   time.Time   `json:"created_at"`
}

type TariffConfig struct {
	ID              string      `json:"id"`
	LocationID      string      `json:"location_id"`
	VehicleType     VehicleType `json:"vehicle_type"`
	FirstHourRate   int         `json:"first_hour_rate"`
	NextHourRate    int         `json:"next_hour_rate"`
	MaxDailyRate    *int        `json:"max_daily_rate,omitempty"`
	MemberMonthRate *int        `json:"member_month_rate,omitempty"`
	GracePeriodMin  int         `json:"grace_period_min"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}
