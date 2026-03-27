package service

import (
	"context"
	"time"
)

// QRISProvider defines the interface for QRIS payment gateway integrations.
type QRISProvider interface {
	// CreateTransaction initiates a new QRIS payment transaction and returns
	// the QR code data.
	CreateTransaction(ctx context.Context, req QRISCreateRequest) (*QRISCreateResponse, error)

	// CheckStatus queries the provider for the current status of an order.
	CheckStatus(ctx context.Context, orderID string) (*QRISStatusResponse, error)

	// VerifyWebhook validates the authenticity of an inbound webhook payload
	// using the shared secret.
	VerifyWebhook(body []byte, secret string) (bool, error)
}

// QRISCreateRequest contains the parameters needed to create a QRIS transaction.
type QRISCreateRequest struct {
	OrderID     string
	Description string
	Amount      int
}

// QRISCreateResponse contains the QRIS transaction details returned by the
// payment provider.
type QRISCreateResponse struct {
	OrderID       string
	TransactionID string
	QRString      string
	QRURL         string
	ExpiresAt     time.Time
}

// QRISStatusResponse contains the current status of a QRIS transaction.
type QRISStatusResponse struct {
	OrderID string
	Status  string
	PaidAt  *time.Time
	Amount  int
}
