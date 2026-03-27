package model

import "time"

// ---------- Session enums ----------

type SessionStatus string

const (
	SessionStatusActive    SessionStatus = "active"
	SessionStatusCompleted SessionStatus = "completed"
	SessionStatusCancelled SessionStatus = "cancelled"
)

type PaymentStatus string

const (
	PaymentStatusPending  PaymentStatus = "pending"
	PaymentStatusPaid     PaymentStatus = "paid"
	PaymentStatusFailed   PaymentStatus = "failed"
	PaymentStatusRefunded PaymentStatus = "refunded"
)

type PaymentMethod string

const (
	PaymentMethodCash   PaymentMethod = "cash"
	PaymentMethodQRIS   PaymentMethod = "qris"
	PaymentMethodMember PaymentMethod = "member"
)

// ---------- ParkingSession ----------

type ParkingSession struct {
	ID              string         `json:"id"`
	LocationID      string         `json:"location_id"`
	VehicleID       string         `json:"vehicle_id"`
	EntryLaneID     string         `json:"entry_lane_id"`
	ExitLaneID      *string        `json:"exit_lane_id,omitempty"`
	Plate           string         `json:"plate"`
	PlateNormalized string         `json:"plate_normalized"`
	VehicleType     VehicleType    `json:"vehicle_type"`
	EntryPhoto      *string        `json:"entry_photo,omitempty"`
	ExitPhoto       *string        `json:"exit_photo,omitempty"`
	EntryTime       time.Time      `json:"entry_time"`
	ExitTime        *time.Time     `json:"exit_time,omitempty"`
	DurationMinutes *int           `json:"duration_minutes,omitempty"`
	IsMember        bool           `json:"is_member"`
	TariffAmount    *int           `json:"tariff_amount,omitempty"`
	PaymentMethod   *PaymentMethod `json:"payment_method,omitempty"`
	PaymentStatus   PaymentStatus  `json:"payment_status"`
	SessionStatus   SessionStatus  `json:"session_status"`
	OperatorID      *string        `json:"operator_id,omitempty"`
	Notes           *string        `json:"notes,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}
