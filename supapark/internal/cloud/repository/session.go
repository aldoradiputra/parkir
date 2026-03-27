package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type SessionRepo struct {
	pool *pgxpool.Pool
}

func NewSessionRepo(pool *pgxpool.Pool) *SessionRepo {
	return &SessionRepo{pool: pool}
}

func (r *SessionRepo) Create(ctx context.Context, s *model.ParkingSession) error {
	query := `
		INSERT INTO parking_sessions (
			id, location_id, vehicle_id, entry_lane_id, exit_lane_id,
			plate, plate_normalized, vehicle_type, entry_photo, exit_photo,
			entry_time, exit_time, duration_minutes, is_member,
			tariff_amount, payment_method, payment_status, session_status,
			operator_id, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14,
			$15, $16, $17, $18,
			$19, $20, $21, $22
		)`

	_, err := r.pool.Exec(ctx, query,
		s.ID, s.LocationID, s.VehicleID, s.EntryLaneID, s.ExitLaneID,
		s.Plate, s.PlateNormalized, s.VehicleType, s.EntryPhoto, s.ExitPhoto,
		s.EntryTime, s.ExitTime, s.DurationMinutes, s.IsMember,
		s.TariffAmount, s.PaymentMethod, s.PaymentStatus, s.SessionStatus,
		s.OperatorID, s.Notes, s.CreatedAt, s.UpdatedAt,
	)
	return err
}

func (r *SessionRepo) GetByID(ctx context.Context, id string) (*model.ParkingSession, error) {
	query := `
		SELECT
			id, location_id, vehicle_id, entry_lane_id, exit_lane_id,
			plate, plate_normalized, vehicle_type, entry_photo, exit_photo,
			entry_time, exit_time, duration_minutes, is_member,
			tariff_amount, payment_method, payment_status, session_status,
			operator_id, notes, created_at, updated_at
		FROM parking_sessions
		WHERE id = $1`

	var s model.ParkingSession
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.LocationID, &s.VehicleID, &s.EntryLaneID, &s.ExitLaneID,
		&s.Plate, &s.PlateNormalized, &s.VehicleType, &s.EntryPhoto, &s.ExitPhoto,
		&s.EntryTime, &s.ExitTime, &s.DurationMinutes, &s.IsMember,
		&s.TariffAmount, &s.PaymentMethod, &s.PaymentStatus, &s.SessionStatus,
		&s.OperatorID, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *SessionRepo) FindActiveByPlateAndLocation(ctx context.Context, locationID, plateNormalized string) (*model.ParkingSession, error) {
	query := `
		SELECT
			id, location_id, vehicle_id, entry_lane_id, exit_lane_id,
			plate, plate_normalized, vehicle_type, entry_photo, exit_photo,
			entry_time, exit_time, duration_minutes, is_member,
			tariff_amount, payment_method, payment_status, session_status,
			operator_id, notes, created_at, updated_at
		FROM parking_sessions
		WHERE session_status = 'active'
		  AND location_id = $1
		  AND plate_normalized = $2
		ORDER BY entry_time DESC
		LIMIT 1`

	var s model.ParkingSession
	err := r.pool.QueryRow(ctx, query, locationID, plateNormalized).Scan(
		&s.ID, &s.LocationID, &s.VehicleID, &s.EntryLaneID, &s.ExitLaneID,
		&s.Plate, &s.PlateNormalized, &s.VehicleType, &s.EntryPhoto, &s.ExitPhoto,
		&s.EntryTime, &s.ExitTime, &s.DurationMinutes, &s.IsMember,
		&s.TariffAmount, &s.PaymentMethod, &s.PaymentStatus, &s.SessionStatus,
		&s.OperatorID, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *SessionRepo) FindActiveByPlate(ctx context.Context, plateNormalized string) (*model.ParkingSession, error) {
	query := `
		SELECT
			id, location_id, vehicle_id, entry_lane_id, exit_lane_id,
			plate, plate_normalized, vehicle_type, entry_photo, exit_photo,
			entry_time, exit_time, duration_minutes, is_member,
			tariff_amount, payment_method, payment_status, session_status,
			operator_id, notes, created_at, updated_at
		FROM parking_sessions
		WHERE session_status = 'active'
		  AND plate_normalized = $1
		ORDER BY entry_time DESC
		LIMIT 1`

	var s model.ParkingSession
	err := r.pool.QueryRow(ctx, query, plateNormalized).Scan(
		&s.ID, &s.LocationID, &s.VehicleID, &s.EntryLaneID, &s.ExitLaneID,
		&s.Plate, &s.PlateNormalized, &s.VehicleType, &s.EntryPhoto, &s.ExitPhoto,
		&s.EntryTime, &s.ExitTime, &s.DurationMinutes, &s.IsMember,
		&s.TariffAmount, &s.PaymentMethod, &s.PaymentStatus, &s.SessionStatus,
		&s.OperatorID, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *SessionRepo) Update(ctx context.Context, s *model.ParkingSession) error {
	query := `
		UPDATE parking_sessions
		SET exit_lane_id = $2, exit_photo = $3,
		    exit_time = $4, duration_minutes = $5,
		    is_member = $6, tariff_amount = $7,
		    payment_method = $8, payment_status = $9,
		    session_status = $10, updated_at = $11
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query,
		s.ID, s.ExitLaneID, s.ExitPhoto,
		s.ExitTime, s.DurationMinutes,
		s.IsMember, s.TariffAmount,
		s.PaymentMethod, s.PaymentStatus,
		s.SessionStatus, s.UpdatedAt,
	)
	return err
}

func (r *SessionRepo) UpdateExit(ctx context.Context, id string, exitTime time.Time, duration int, fee int) error {
	query := `
		UPDATE parking_sessions
		SET exit_time = $2,
		    duration_minutes = $3,
		    tariff_amount = $4,
		    session_status = 'completed',
		    updated_at = NOW()
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query, id, exitTime, duration, fee)
	return err
}

func (r *SessionRepo) UpdatePayment(ctx context.Context, id string, method model.PaymentMethod, status model.PaymentStatus, paid int) error {
	query := `
		UPDATE parking_sessions
		SET payment_method = $2,
		    payment_status = $3,
		    tariff_amount = $4,
		    updated_at = NOW()
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query, id, method, status, paid)
	return err
}

func (r *SessionRepo) List(ctx context.Context, locationID string, limit, offset int) ([]model.ParkingSession, int, error) {
	countQuery := `SELECT COUNT(*) FROM parking_sessions WHERE location_id = $1`
	var total int
	if err := r.pool.QueryRow(ctx, countQuery, locationID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			id, location_id, vehicle_id, entry_lane_id, exit_lane_id,
			plate, plate_normalized, vehicle_type, entry_photo, exit_photo,
			entry_time, exit_time, duration_minutes, is_member,
			tariff_amount, payment_method, payment_status, session_status,
			operator_id, notes, created_at, updated_at
		FROM parking_sessions
		WHERE location_id = $1
		ORDER BY entry_time DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.pool.Query(ctx, query, locationID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var sessions []model.ParkingSession
	for rows.Next() {
		var s model.ParkingSession
		if err := rows.Scan(
			&s.ID, &s.LocationID, &s.VehicleID, &s.EntryLaneID, &s.ExitLaneID,
			&s.Plate, &s.PlateNormalized, &s.VehicleType, &s.EntryPhoto, &s.ExitPhoto,
			&s.EntryTime, &s.ExitTime, &s.DurationMinutes, &s.IsMember,
			&s.TariffAmount, &s.PaymentMethod, &s.PaymentStatus, &s.SessionStatus,
			&s.OperatorID, &s.Notes, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		sessions = append(sessions, s)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return sessions, total, nil
}
