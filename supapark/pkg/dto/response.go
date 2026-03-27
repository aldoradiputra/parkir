package dto

import (
	"time"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type EntryResponse struct {
	SessionID   string            `json:"session_id"`
	Plate       string            `json:"plate"`
	VehicleType model.VehicleType `json:"vehicle_type"`
	IsMember    bool              `json:"is_member"`
	EntryTime   time.Time         `json:"entry_time"`
	Phone       *string           `json:"phone,omitempty"` // so edge can cache for offline notifications
}

type ExitResponse struct {
	SessionID       string              `json:"session_id"`
	Plate           string              `json:"plate"`
	VehicleType     model.VehicleType   `json:"vehicle_type"`
	EntryTime       time.Time           `json:"entry_time"`
	ExitTime        time.Time           `json:"exit_time"`
	DurationMinutes int                 `json:"duration_minutes"`
	TariffAmount    int                 `json:"tariff_amount"`
	IsMember        bool                `json:"is_member"`
	PaymentStatus   model.PaymentStatus `json:"payment_status"`
	QRString        *string             `json:"qr_string,omitempty"`  // inline QRIS for faster display
	QRURL           *string             `json:"qr_url,omitempty"`
	PaymentID       *string             `json:"payment_id,omitempty"`
}

type CreateQRISResponse struct {
	PaymentID string  `json:"payment_id"`
	OrderID   string  `json:"order_id"`
	QRString  string  `json:"qr_string"`
	QRURL     *string `json:"qr_url,omitempty"`
	Amount    int     `json:"amount"`
	ExpiresAt time.Time `json:"expires_at"`
}

type PaymentStatusResponse struct {
	PaymentID     string              `json:"payment_id"`
	SessionID     string              `json:"session_id"`
	Status        model.PaymentStatus `json:"status"`
	Method        model.PaymentMethod `json:"method"`
	Amount        int                 `json:"amount"`
	PaidAt        *time.Time          `json:"paid_at,omitempty"`
	ProviderTxnID *string             `json:"provider_txn_id,omitempty"`
}

type SessionResponse struct {
	ID              string               `json:"id"`
	LocationID      string               `json:"location_id"`
	Plate           string               `json:"plate"`
	VehicleType     model.VehicleType    `json:"vehicle_type"`
	EntryTime       time.Time            `json:"entry_time"`
	ExitTime        *time.Time           `json:"exit_time,omitempty"`
	DurationMinutes *int                 `json:"duration_minutes,omitempty"`
	IsMember        bool                 `json:"is_member"`
	TariffAmount    *int                 `json:"tariff_amount,omitempty"`
	PaymentMethod   *model.PaymentMethod `json:"payment_method,omitempty"`
	PaymentStatus   model.PaymentStatus  `json:"payment_status"`
	SessionStatus   model.SessionStatus  `json:"session_status"`
}

type LoginResponse struct {
	Token     string     `json:"token"`
	ExpiresAt time.Time  `json:"expires_at"`
	User      UserBrief  `json:"user"`
}

type UserBrief struct {
	ID       string         `json:"id"`
	Username string         `json:"username"`
	FullName string         `json:"full_name"`
	Role     model.UserRole `json:"role"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

type VehicleResponse struct {
	ID          string          `json:"id"`
	Plate       string          `json:"plate"`
	VehicleType model.VehicleType `json:"vehicle_type"`
	Phone       *string         `json:"phone,omitempty"`
	IsMember    bool            `json:"is_member"`
	VisitCount  int             `json:"visit_count"`
	LastSeen    time.Time       `json:"last_seen"`
}
