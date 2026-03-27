package model

import "time"

type Payment struct {
	ID             string        `json:"id"`
	SessionID      string        `json:"session_id"`
	Method         PaymentMethod `json:"method"`
	Amount         int           `json:"amount"`
	OrderID        string        `json:"order_id"`
	ProviderTxnID  *string       `json:"provider_txn_id,omitempty"`
	QRString       *string       `json:"qr_string,omitempty"`
	QRURL          *string       `json:"qr_url,omitempty"`
	Status         PaymentStatus `json:"status"`
	WebhookPayload *string       `json:"webhook_payload,omitempty"` // JSON
	PaidAt         *time.Time    `json:"paid_at,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}
