package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type LeadRepo struct {
	pool *pgxpool.Pool
}

func NewLeadRepo(pool *pgxpool.Pool) *LeadRepo {
	return &LeadRepo{pool: pool}
}

func (r *LeadRepo) Create(ctx context.Context, lead *model.Lead) error {
	query := `
		INSERT INTO leads (name, email, phone, facility_name, source, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, query,
		lead.Name, lead.Email, lead.Phone, lead.FacilityName,
		lead.Source, lead.Status,
	).Scan(&lead.ID, &lead.CreatedAt, &lead.UpdatedAt)
}

func (r *LeadRepo) GetByID(ctx context.Context, id string) (*model.Lead, error) {
	query := `
		SELECT id, name, email, phone, facility_name, source, status,
		       city, address, latitude, longitude, entry_lanes, exit_lanes,
		       current_system, daily_volume, preferred_date, notes,
		       onboarded_at, converted_at, project_id, created_at, updated_at
		FROM leads WHERE id = $1`

	var l model.Lead
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&l.ID, &l.Name, &l.Email, &l.Phone, &l.FacilityName,
		&l.Source, &l.Status,
		&l.City, &l.Address, &l.Latitude, &l.Longitude,
		&l.EntryLanes, &l.ExitLanes, &l.CurrentSystem,
		&l.DailyVolume, &l.PreferredDate, &l.Notes,
		&l.OnboardedAt, &l.ConvertedAt, &l.ProjectID,
		&l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &l, nil
}

func (r *LeadRepo) List(ctx context.Context, status *model.LeadStatus, search string, limit, offset int) ([]model.Lead, int, error) {
	countQuery := `SELECT COUNT(*) FROM leads WHERE 1=1`
	listQuery := `
		SELECT id, name, email, phone, facility_name, source, status,
		       city, address, latitude, longitude, entry_lanes, exit_lanes,
		       current_system, daily_volume, preferred_date, notes,
		       onboarded_at, converted_at, project_id, created_at, updated_at
		FROM leads WHERE 1=1`

	var args []interface{}
	argIdx := 1

	if status != nil {
		clause := fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += clause
		listQuery += clause
		args = append(args, *status)
		argIdx++
	}

	if search != "" {
		clause := fmt.Sprintf(" AND (name ILIKE $%d OR email ILIKE $%d OR phone ILIKE $%d OR facility_name ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		countQuery += clause
		listQuery += clause
		args = append(args, "%"+search+"%")
		argIdx++
	}

	var total int
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	listQuery += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var leads []model.Lead
	for rows.Next() {
		var l model.Lead
		if err := rows.Scan(
			&l.ID, &l.Name, &l.Email, &l.Phone, &l.FacilityName,
			&l.Source, &l.Status,
			&l.City, &l.Address, &l.Latitude, &l.Longitude,
			&l.EntryLanes, &l.ExitLanes, &l.CurrentSystem,
			&l.DailyVolume, &l.PreferredDate, &l.Notes,
			&l.OnboardedAt, &l.ConvertedAt, &l.ProjectID,
			&l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		leads = append(leads, l)
	}

	return leads, total, nil
}

func (r *LeadRepo) Update(ctx context.Context, lead *model.Lead) error {
	query := `
		UPDATE leads SET
			name = $2, email = $3, phone = $4, facility_name = $5,
			source = $6, status = $7,
			city = $8, address = $9, latitude = $10, longitude = $11,
			entry_lanes = $12, exit_lanes = $13, current_system = $14,
			daily_volume = $15, preferred_date = $16, notes = $17,
			onboarded_at = $18, converted_at = $19, project_id = $20
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query,
		lead.ID, lead.Name, lead.Email, lead.Phone, lead.FacilityName,
		lead.Source, lead.Status,
		lead.City, lead.Address, lead.Latitude, lead.Longitude,
		lead.EntryLanes, lead.ExitLanes, lead.CurrentSystem,
		lead.DailyVolume, lead.PreferredDate, lead.Notes,
		lead.OnboardedAt, lead.ConvertedAt, lead.ProjectID,
	)
	return err
}

func (r *LeadRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM leads WHERE id = $1`, id)
	return err
}
