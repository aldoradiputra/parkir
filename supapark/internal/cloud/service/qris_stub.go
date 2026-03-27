package service

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// StubQRIS is a mock QRIS provider for development and testing. It simulates
// payment flow without connecting to an external gateway.
type StubQRIS struct {
	mu      sync.Mutex
	orders  map[string]time.Time // orderID -> creation time
	logger  *slog.Logger
}

// NewStubQRIS creates a new StubQRIS instance.
func NewStubQRIS(logger *slog.Logger) *StubQRIS {
	return &StubQRIS{
		orders: make(map[string]time.Time),
		logger: logger,
	}
}

// CreateTransaction returns a mock QR code string and URL. The transaction
// is recorded in memory so CheckStatus can track it.
func (s *StubQRIS) CreateTransaction(_ context.Context, req QRISCreateRequest) (*QRISCreateResponse, error) {
	s.mu.Lock()
	s.orders[req.OrderID] = time.Now()
	s.mu.Unlock()

	s.logger.Info("stub QRIS: transaction created",
		"order_id", req.OrderID,
		"amount", req.Amount,
	)

	return &QRISCreateResponse{
		OrderID:       req.OrderID,
		TransactionID: fmt.Sprintf("STUB-TXN-%s", req.OrderID),
		QRString:      "00020101021226610014COM.SUPAPARK.STUB0115ID20230001234560215STUB" + req.OrderID + "5303360540" + fmt.Sprintf("%d", req.Amount) + "5802ID5913SUPAPARK STUB6013JAKARTA PUSAT6105101106304ABCD",
		QRURL:         fmt.Sprintf("https://stub.supapark.dev/qr/%s", req.OrderID),
		ExpiresAt:     time.Now().Add(5 * time.Minute),
	}, nil
}

// CheckStatus returns "paid" for orders older than 10 seconds, "pending"
// otherwise. This simulates a realistic payment delay for development.
func (s *StubQRIS) CheckStatus(_ context.Context, orderID string) (*QRISStatusResponse, error) {
	s.mu.Lock()
	createdAt, ok := s.orders[orderID]
	s.mu.Unlock()

	if !ok {
		return &QRISStatusResponse{
			OrderID: orderID,
			Status:  "not_found",
		}, nil
	}

	if time.Since(createdAt) > 10*time.Second {
		now := time.Now()
		return &QRISStatusResponse{
			OrderID: orderID,
			Status:  "paid",
			PaidAt:  &now,
			Amount:  0, // Stub does not track amounts
		}, nil
	}

	return &QRISStatusResponse{
		OrderID: orderID,
		Status:  "pending",
	}, nil
}

// VerifyWebhook always returns true for the stub provider.
func (s *StubQRIS) VerifyWebhook(_ []byte, _ string) (bool, error) {
	return true, nil
}
