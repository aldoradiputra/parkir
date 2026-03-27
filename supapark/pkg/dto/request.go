package dto

import "github.com/aldoradiputra/supapark/pkg/model"

type EntryRequest struct {
	LocationID  string          `json:"location_id" validate:"required,uuid"`
	LaneID      string          `json:"lane_id" validate:"required,uuid"`
	Plate       string          `json:"plate" validate:"required"`
	VehicleType model.VehicleType `json:"vehicle_type" validate:"required,oneof=car motorcycle"`
	Photo       *string         `json:"photo,omitempty"`
}

type ExitRequest struct {
	SessionID string  `json:"session_id" validate:"required,uuid"`
	LaneID    string  `json:"lane_id" validate:"required,uuid"`
	Plate     string  `json:"plate" validate:"required"`
	Photo     *string `json:"photo,omitempty"`
}

type CreateQRISRequest struct {
	SessionID string `json:"session_id" validate:"required,uuid"`
	Amount    int    `json:"amount" validate:"required,gt=0"`
}

type LinkVehicleRequest struct {
	Plate string `json:"plate" validate:"required"`
	Phone string `json:"phone" validate:"required"`
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type PrepayRequest struct {
	SessionID     string             `json:"session_id" validate:"required,uuid"`
	PaymentMethod model.PaymentMethod `json:"payment_method" validate:"required,oneof=cash qris member"`
	Amount        int                `json:"amount" validate:"required,gt=0"`
}
