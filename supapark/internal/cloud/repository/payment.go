package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type PaymentRepo struct {
	pool *pgxpool.Pool
}

func NewPaymentRepo(pool *pgxpool.Pool) *PaymentRepo {
	return &PaymentRepo{pool: pool}
}

func (r *PaymentRepo) Create(ctx context.Context, p *model.Payment) error {
	query := `
		INSERT INTO payments (
			id, session_id, method, amount, order_id,
			provider_txn_id, qr_string, qr_url, status,
			webhook_payload, paid_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13
		)`

	_, err := r.pool.Exec(ctx, query,
		p.ID, p.SessionID, p.Method, p.Amount, p.OrderID,
		p.ProviderTxnID, p.QRString, p.QRURL, p.Status,
		p.WebhookPayload, p.PaidAt, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *PaymentRepo) GetByID(ctx context.Context, id string) (*model.Payment, error) {
	query := `
		SELECT
			id, session_id, method, amount, order_id,
			provider_txn_id, qr_string, qr_url, status,
			webhook_payload, paid_at, created_at, updated_at
		FROM payments
		WHERE id = $1`

	return r.scanOne(ctx, query, id)
}

func (r *PaymentRepo) FindByOrderID(ctx context.Context, orderID string) (*model.Payment, error) {
	query := `
		SELECT
			id, session_id, method, amount, order_id,
			provider_txn_id, qr_string, qr_url, status,
			webhook_payload, paid_at, created_at, updated_at
		FROM payments
		WHERE order_id = $1`

	return r.scanOne(ctx, query, orderID)
}

func (r *PaymentRepo) FindBySessionID(ctx context.Context, sessionID string) (*model.Payment, error) {
	query := `
		SELECT
			id, session_id, method, amount, order_id,
			provider_txn_id, qr_string, qr_url, status,
			webhook_payload, paid_at, created_at, updated_at
		FROM payments
		WHERE session_id = $1
		ORDER BY created_at DESC
		LIMIT 1`

	return r.scanOne(ctx, query, sessionID)
}

func (r *PaymentRepo) Update(ctx context.Context, p *model.Payment) error {
	query := `
		UPDATE payments
		SET status = $2,
		    paid_at = $3,
		    provider_txn_id = $4,
		    webhook_payload = $5,
		    updated_at = $6
		WHERE id = $1`

	_, err := r.pool.Exec(ctx, query,
		p.ID, p.Status, p.PaidAt, p.ProviderTxnID, p.WebhookPayload, p.UpdatedAt,
	)
	return err
}

func (r *PaymentRepo) UpdateStatus(ctx context.Context, id string, status model.PaymentStatus, paidAt *time.Time, providerTxnID string, webhookPayload []byte) error {
	query := `
		UPDATE payments
		SET status = $2,
		    paid_at = $3,
		    provider_txn_id = $4,
		    webhook_payload = $5,
		    updated_at = NOW()
		WHERE id = $1`

	var payload *string
	if webhookPayload != nil {
		s := string(webhookPayload)
		payload = &s
	}

	_, err := r.pool.Exec(ctx, query, id, status, paidAt, providerTxnID, payload)
	return err
}

func (r *PaymentRepo) scanOne(ctx context.Context, query string, arg interface{}) (*model.Payment, error) {
	var p model.Payment
	err := r.pool.QueryRow(ctx, query, arg).Scan(
		&p.ID, &p.SessionID, &p.Method, &p.Amount, &p.OrderID,
		&p.ProviderTxnID, &p.QRString, &p.QRURL, &p.Status,
		&p.WebhookPayload, &p.PaidAt, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}
