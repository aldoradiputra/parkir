package model

import "time"

type VehicleType string

const (
	VehicleTypeCar        VehicleType = "car"
	VehicleTypeMotorcycle VehicleType = "motorcycle"
)

type Vehicle struct {
	ID               string      `json:"id"`
	Plate            string      `json:"plate"`
	PlateNormalized  string      `json:"plate_normalized"`
	VehicleType      VehicleType `json:"vehicle_type"`
	Phone            *string     `json:"phone,omitempty"`
	PhoneVerified    bool        `json:"phone_verified"`
	PushSubscription *string     `json:"push_subscription,omitempty"` // JSON
	FirstSeen        time.Time   `json:"first_seen"`
	LastSeen         time.Time   `json:"last_seen"`
	VisitCount       int         `json:"visit_count"`
}
