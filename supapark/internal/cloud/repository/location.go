package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/model"
)

// ---------- LocationRepo ----------

type LocationRepo struct {
	pool *pgxpool.Pool
}

func NewLocationRepo(pool *pgxpool.Pool) *LocationRepo {
	return &LocationRepo{pool: pool}
}

func (r *LocationRepo) FindByID(ctx context.Context, id string) (*model.Location, error) {
	query := `
		SELECT id, name, address, timezone, created_at, updated_at
		FROM locations
		WHERE id = $1`

	var loc model.Location
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&loc.ID, &loc.Name, &loc.Address, &loc.Timezone,
		&loc.CreatedAt, &loc.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &loc, nil
}

func (r *LocationRepo) List(ctx context.Context) ([]model.Location, error) {
	query := `SELECT id, name, address, timezone, created_at, updated_at FROM locations ORDER BY name`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []model.Location
	for rows.Next() {
		var loc model.Location
		if err := rows.Scan(
			&loc.ID, &loc.Name, &loc.Address, &loc.Timezone,
			&loc.CreatedAt, &loc.UpdatedAt,
		); err != nil {
			return nil, err
		}
		locations = append(locations, loc)
	}
	return locations, rows.Err()
}

func (r *LocationRepo) ListPublic(ctx context.Context) ([]dto.PublicLocationResponse, error) {
	query := `SELECT id, name, latitude, longitude FROM locations ORDER BY name`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locations []dto.PublicLocationResponse
	for rows.Next() {
		var loc dto.PublicLocationResponse
		if err := rows.Scan(&loc.ID, &loc.Name, &loc.Latitude, &loc.Longitude); err != nil {
			return nil, err
		}
		locations = append(locations, loc)
	}
	return locations, rows.Err()
}

// ---------- LaneRepo ----------

type LaneRepo struct {
	pool *pgxpool.Pool
}

func NewLaneRepo(pool *pgxpool.Pool) *LaneRepo {
	return &LaneRepo{pool: pool}
}

func (r *LaneRepo) FindByID(ctx context.Context, id string) (*model.Lane, error) {
	query := `
		SELECT id, location_id, name, lane_type, status, camera_url, created_at, updated_at
		FROM lanes
		WHERE id = $1`

	var lane model.Lane
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&lane.ID, &lane.LocationID, &lane.Name, &lane.LaneType,
		&lane.Status, &lane.CameraURL, &lane.CreatedAt, &lane.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &lane, nil
}

func (r *LaneRepo) FindByAPIKey(ctx context.Context, apiKey string) (*model.Lane, error) {
	query := `
		SELECT id, location_id, name, lane_type, status, camera_url, created_at, updated_at
		FROM lanes
		WHERE api_key = $1`

	var lane model.Lane
	err := r.pool.QueryRow(ctx, query, apiKey).Scan(
		&lane.ID, &lane.LocationID, &lane.Name, &lane.LaneType,
		&lane.Status, &lane.CameraURL, &lane.CreatedAt, &lane.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &lane, nil
}

func (r *LaneRepo) ListByLocation(ctx context.Context, locationID string) ([]model.Lane, error) {
	query := `
		SELECT id, location_id, name, lane_type, status, camera_url, created_at, updated_at
		FROM lanes
		WHERE location_id = $1
		ORDER BY name`

	rows, err := r.pool.Query(ctx, query, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lanes []model.Lane
	for rows.Next() {
		var lane model.Lane
		if err := rows.Scan(
			&lane.ID, &lane.LocationID, &lane.Name, &lane.LaneType,
			&lane.Status, &lane.CameraURL, &lane.CreatedAt, &lane.UpdatedAt,
		); err != nil {
			return nil, err
		}
		lanes = append(lanes, lane)
	}
	return lanes, rows.Err()
}

// ---------- MemberRepo ----------

type MemberRepo struct {
	pool *pgxpool.Pool
}

func NewMemberRepo(pool *pgxpool.Pool) *MemberRepo {
	return &MemberRepo{pool: pool}
}

func (r *MemberRepo) IsActiveMember(ctx context.Context, locationID, vehicleID string, at time.Time) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM members
			WHERE location_id = $1
			  AND vehicle_id = $2
			  AND is_active = true
			  AND start_date <= $3
			  AND end_date >= $3
		)`

	var exists bool
	err := r.pool.QueryRow(ctx, query, locationID, vehicleID, at).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// ---------- TariffRepo ----------

type TariffRepo struct {
	pool *pgxpool.Pool
}

func NewTariffRepo(pool *pgxpool.Pool) *TariffRepo {
	return &TariffRepo{pool: pool}
}

func (r *TariffRepo) FindByLocationAndType(ctx context.Context, locationID string, vehicleType model.VehicleType) (*model.TariffConfig, error) {
	query := `
		SELECT id, location_id, vehicle_type, first_hour_rate, next_hour_rate,
		       max_daily_rate, member_month_rate, grace_period_min, created_at, updated_at
		FROM tariff_configs
		WHERE location_id = $1 AND vehicle_type = $2`

	var t model.TariffConfig
	err := r.pool.QueryRow(ctx, query, locationID, vehicleType).Scan(
		&t.ID, &t.LocationID, &t.VehicleType, &t.FirstHourRate, &t.NextHourRate,
		&t.MaxDailyRate, &t.MemberMonthRate, &t.GracePeriodMin, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}
