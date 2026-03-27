package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (r *UserRepo) FindByUsername(ctx context.Context, username string) (*model.User, error) {
	query := `
		SELECT id, location_id, username, password_hash, full_name,
		       role, is_active, last_login_at, created_at, updated_at
		FROM users
		WHERE username = $1`

	var u model.User
	err := r.pool.QueryRow(ctx, query, username).Scan(
		&u.ID, &u.LocationID, &u.Username, &u.PasswordHash, &u.FullName,
		&u.Role, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) Create(ctx context.Context, u *model.User) error {
	query := `
		INSERT INTO users (
			id, location_id, username, password_hash, full_name,
			role, is_active, last_login_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10
		)`

	_, err := r.pool.Exec(ctx, query,
		u.ID, u.LocationID, u.Username, u.PasswordHash, u.FullName,
		u.Role, u.IsActive, u.LastLoginAt, u.CreatedAt, u.UpdatedAt,
	)
	return err
}
