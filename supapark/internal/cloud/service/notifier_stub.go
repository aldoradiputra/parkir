package service

import (
	"context"
	"log/slog"
)

// StubNotifier is a no-op notifier that logs outbound messages instead of
// sending them. It is used during development and testing.
type StubNotifier struct {
	logger *slog.Logger
}

// NewStubNotifier creates a new StubNotifier.
func NewStubNotifier(logger *slog.Logger) *StubNotifier {
	return &StubNotifier{logger: logger}
}

// SendPaymentLink logs the payment link that would be sent in production.
func (n *StubNotifier) SendPaymentLink(_ context.Context, phone, paymentURL string, sessionID string) error {
	n.logger.Info("would send payment link",
		"phone", phone,
		"payment_url", paymentURL,
		"session_id", sessionID,
	)
	return nil
}
