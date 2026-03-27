package service

import "context"

// Notifier defines the interface for sending payment notifications to vehicle
// owners via external messaging channels (WhatsApp, Telegram, etc.).
type Notifier interface {
	// SendPaymentLink sends a payment link to the given phone number for the
	// specified parking session.
	SendPaymentLink(ctx context.Context, phone, paymentURL string, sessionID string) error
}
