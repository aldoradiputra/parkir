package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type ProjectRepo struct {
	pool *pgxpool.Pool
}

func NewProjectRepo(pool *pgxpool.Pool) *ProjectRepo {
	return &ProjectRepo{pool: pool}
}

func (r *ProjectRepo) Create(ctx context.Context, p *model.Project) error {
	query := `
		INSERT INTO projects (
			lead_id, facility_name, contact_name, contact_email, contact_phone,
			city, address, latitude, longitude,
			entry_lanes, exit_lanes, status, start_date, target_live, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, query,
		p.LeadID, p.FacilityName, p.ContactName, p.ContactEmail, p.ContactPhone,
		p.City, p.Address, p.Latitude, p.Longitude,
		p.EntryLanes, p.ExitLanes, p.Status, p.StartDate, p.TargetLive, p.Notes,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *ProjectRepo) GetByID(ctx context.Context, id string) (*model.Project, error) {
	query := `
		SELECT id, lead_id, location_id,
		       facility_name, contact_name, contact_email, contact_phone,
		       city, address, latitude, longitude,
		       entry_lanes, exit_lanes, status,
		       start_date, target_live, actual_live, notes,
		       created_at, updated_at
		FROM projects WHERE id = $1`

	var p model.Project
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.LeadID, &p.LocationID,
		&p.FacilityName, &p.ContactName, &p.ContactEmail, &p.ContactPhone,
		&p.City, &p.Address, &p.Latitude, &p.Longitude,
		&p.EntryLanes, &p.ExitLanes, &p.Status,
		&p.StartDate, &p.TargetLive, &p.ActualLive, &p.Notes,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *ProjectRepo) List(ctx context.Context, status *model.ProjectStatus, search string, limit, offset int) ([]model.Project, int, error) {
	countQuery := `SELECT COUNT(*) FROM projects WHERE 1=1`
	listQuery := `
		SELECT id, lead_id, location_id,
		       facility_name, contact_name, contact_email, contact_phone,
		       city, address, latitude, longitude,
		       entry_lanes, exit_lanes, status,
		       start_date, target_live, actual_live, notes,
		       created_at, updated_at
		FROM projects WHERE 1=1`

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
		clause := fmt.Sprintf(" AND (facility_name ILIKE $%d OR contact_name ILIKE $%d OR city ILIKE $%d)", argIdx, argIdx, argIdx)
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

	var projects []model.Project
	for rows.Next() {
		var p model.Project
		if err := rows.Scan(
			&p.ID, &p.LeadID, &p.LocationID,
			&p.FacilityName, &p.ContactName, &p.ContactEmail, &p.ContactPhone,
			&p.City, &p.Address, &p.Latitude, &p.Longitude,
			&p.EntryLanes, &p.ExitLanes, &p.Status,
			&p.StartDate, &p.TargetLive, &p.ActualLive, &p.Notes,
			&p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		projects = append(projects, p)
	}

	return projects, total, nil
}

func (r *ProjectRepo) Update(ctx context.Context, p *model.Project) error {
	query := `
		UPDATE projects SET
			location_id = $2,
			facility_name = $3, contact_name = $4, contact_email = $5, contact_phone = $6,
			city = $7, address = $8, latitude = $9, longitude = $10,
			entry_lanes = $11, exit_lanes = $12, status = $13,
			start_date = $14, target_live = $15, actual_live = $16, notes = $17
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query,
		p.ID, p.LocationID,
		p.FacilityName, p.ContactName, p.ContactEmail, p.ContactPhone,
		p.City, p.Address, p.Latitude, p.Longitude,
		p.EntryLanes, p.ExitLanes, p.Status,
		p.StartDate, p.TargetLive, p.ActualLive, p.Notes,
	)
	return err
}

func (r *ProjectRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	return err
}
