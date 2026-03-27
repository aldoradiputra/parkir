package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type VehicleRepo struct {
	pool *pgxpool.Pool
}

func NewVehicleRepo(pool *pgxpool.Pool) *VehicleRepo {
	return &VehicleRepo{pool: pool}
}

func (r *VehicleRepo) Upsert(ctx context.Context, v *model.Vehicle) (*model.Vehicle, error) {
	query := `
		INSERT INTO vehicles (
			id, plate, plate_normalized, vehicle_type, phone,
			phone_verified, push_subscription, first_seen, last_seen, visit_count
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10
		)
		ON CONFLICT (plate_normalized) DO UPDATE
		SET last_seen = EXCLUDED.last_seen,
		    visit_count = vehicles.visit_count + 1
		RETURNING id, plate, plate_normalized, vehicle_type, phone,
		          phone_verified, push_subscription, first_seen, last_seen, visit_count`

	var result model.Vehicle
	err := r.pool.QueryRow(ctx, query,
		v.ID, v.Plate, v.PlateNormalized, v.VehicleType, v.Phone,
		v.PhoneVerified, v.PushSubscription, v.FirstSeen, v.LastSeen, v.VisitCount,
	).Scan(
		&result.ID, &result.Plate, &result.PlateNormalized, &result.VehicleType, &result.Phone,
		&result.PhoneVerified, &result.PushSubscription, &result.FirstSeen, &result.LastSeen, &result.VisitCount,
	)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *VehicleRepo) FindByPlateNormalized(ctx context.Context, plate string) (*model.Vehicle, error) {
	query := `
		SELECT
			id, plate, plate_normalized, vehicle_type, phone,
			phone_verified, push_subscription, first_seen, last_seen, visit_count
		FROM vehicles
		WHERE plate_normalized = $1`

	var v model.Vehicle
	err := r.pool.QueryRow(ctx, query, plate).Scan(
		&v.ID, &v.Plate, &v.PlateNormalized, &v.VehicleType, &v.Phone,
		&v.PhoneVerified, &v.PushSubscription, &v.FirstSeen, &v.LastSeen, &v.VisitCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &v, nil
}

func (r *VehicleRepo) LinkPhone(ctx context.Context, plateNormalized, phone string) error {
	query := `UPDATE vehicles SET phone = $1, updated_at = NOW() WHERE plate_normalized = $2`
	_, err := r.pool.Exec(ctx, query, phone, plateNormalized)
	return err
}
