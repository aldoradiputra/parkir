package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

// PaymentRepo defines the persistence operations required by PaymentService.
type PaymentRepo interface {
	Create(ctx context.Context, payment *model.Payment) error
	GetByID(ctx context.Context, id string) (*model.Payment, error)
	FindByOrderID(ctx context.Context, orderID string) (*model.Payment, error)
	FindBySessionID(ctx context.Context, sessionID string) (*model.Payment, error)
	Update(ctx context.Context, payment *model.Payment) error
}

// WebSocketBroadcaster defines the interface for pushing real-time updates to
// connected lane clients.
type WebSocketBroadcaster interface {
	SendToLane(laneID string, data []byte)
}

// PaymentService implements payment business logic including QRIS generation,
// webhook processing, and status queries.
type PaymentService struct {
	paymentRepo PaymentRepo
	sessionRepo SessionRepo
	qris        QRISProvider
	notifier    Notifier
	hub         WebSocketBroadcaster
	logger      *slog.Logger
}

// NewPaymentService creates a new PaymentService with the required dependencies.
func NewPaymentService(
	paymentRepo PaymentRepo,
	sessionRepo SessionRepo,
	qris QRISProvider,
	notifier Notifier,
	hub WebSocketBroadcaster,
	logger *slog.Logger,
) *PaymentService {
	return &PaymentService{
		paymentRepo: paymentRepo,
		sessionRepo: sessionRepo,
		qris:        qris,
		notifier:    notifier,
		hub:         hub,
		logger:      logger,
	}
}

// CreateQRIS generates a QRIS payment code for the given session and amount.
// It calls the QRIS provider, persists the payment record, and returns the QR
// data to the caller.
func (s *PaymentService) CreateQRIS(ctx context.Context, sessionID string, amount int) (*dto.CreateQRISResponse, error) {
	session, err := s.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return nil, errx.NotFound("session not found")
	}

	if session.SessionStatus != model.SessionStatusActive && session.SessionStatus != model.SessionStatusCompleted {
		return nil, errx.BadRequest("session is not eligible for payment")
	}

	orderID := fmt.Sprintf("SP-%d-%04d", time.Now().UnixMilli(), rand.Intn(10000))

	qrisResp, err := s.qris.CreateTransaction(ctx, QRISCreateRequest{
		OrderID:     orderID,
		Description: fmt.Sprintf("Parking fee for %s", session.Plate),
		Amount:      amount,
	})
	if err != nil {
		s.logger.Error("QRIS provider failed", "order_id", orderID, "error", err)
		return nil, errx.PaymentFailed("failed to create QRIS transaction")
	}

	now := time.Now()
	payment := &model.Payment{
		SessionID: sessionID,
		Method:    model.PaymentMethodQRIS,
		Amount:    amount,
		OrderID:   orderID,
		QRString:  &qrisResp.QRString,
		QRURL:     &qrisResp.QRURL,
		Status:    model.PaymentStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if qrisResp.TransactionID != "" {
		payment.ProviderTxnID = &qrisResp.TransactionID
	}

	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		s.logger.Error("failed to save payment record", "order_id", orderID, "error", err)
		return nil, fmt.Errorf("save payment: %w", err)
	}

	s.logger.Info("QRIS payment created",
		"payment_id", payment.ID,
		"order_id", orderID,
		"session_id", sessionID,
		"amount", amount,
	)

	return &dto.CreateQRISResponse{
		PaymentID: payment.ID,
		OrderID:   orderID,
		QRString:  qrisResp.QRString,
		QRURL:     &qrisResp.QRURL,
		Amount:    amount,
		ExpiresAt: qrisResp.ExpiresAt,
	}, nil
}

// ProcessWebhook handles an inbound payment notification from the QRIS provider.
// It updates the payment and session records and broadcasts the result to
// connected WebSocket clients.
func (s *PaymentService) ProcessWebhook(ctx context.Context, orderID string, status string, amount int, payload []byte) error {
	payment, err := s.paymentRepo.FindByOrderID(ctx, orderID)
	if err != nil {
		s.logger.Warn("webhook for unknown order", "order_id", orderID)
		return errx.NotFound("payment not found for order_id")
	}

	paymentStatus := mapProviderStatus(status)
	payment.Status = paymentStatus
	payment.UpdatedAt = time.Now()

	payloadStr := string(payload)
	payment.WebhookPayload = &payloadStr

	if paymentStatus == model.PaymentStatusPaid {
		now := time.Now()
		payment.PaidAt = &now
	}

	if err := s.paymentRepo.Update(ctx, payment); err != nil {
		s.logger.Error("failed to update payment from webhook", "order_id", orderID, "error", err)
		return fmt.Errorf("update payment: %w", err)
	}

	session, err := s.sessionRepo.GetByID(ctx, payment.SessionID)
	if err != nil {
		s.logger.Error("failed to find session for payment", "session_id", payment.SessionID, "error", err)
		return fmt.Errorf("find session: %w", err)
	}

	session.PaymentStatus = paymentStatus
	qrisMethod := model.PaymentMethodQRIS
	session.PaymentMethod = &qrisMethod
	session.UpdatedAt = time.Now()

	if err := s.sessionRepo.Update(ctx, session); err != nil {
		s.logger.Error("failed to update session from webhook", "session_id", session.ID, "error", err)
		return fmt.Errorf("update session: %w", err)
	}

	s.logger.Info("webhook processed",
		"order_id", orderID,
		"payment_id", payment.ID,
		"status", paymentStatus,
	)

	// Broadcast payment update to connected lane clients.
	if session.ExitLaneID != nil {
		wsMsg, _ := json.Marshal(map[string]interface{}{
			"type":           "payment_update",
			"session_id":     session.ID,
			"payment_status": string(paymentStatus),
			"amount":         amount,
		})
		s.hub.SendToLane(*session.ExitLaneID, wsMsg)
	}

	return nil
}

// GetStatus retrieves the current payment status for a given session.
func (s *PaymentService) GetStatus(ctx context.Context, sessionID string) (*dto.PaymentStatusResponse, error) {
	payment, err := s.paymentRepo.FindBySessionID(ctx, sessionID)
	if err != nil {
		return nil, errx.NotFound("payment not found for session")
	}

	return &dto.PaymentStatusResponse{
		PaymentID:     payment.ID,
		SessionID:     payment.SessionID,
		Status:        payment.Status,
		Method:        payment.Method,
		Amount:        payment.Amount,
		PaidAt:        payment.PaidAt,
		ProviderTxnID: payment.ProviderTxnID,
	}, nil
}

// mapProviderStatus converts a provider-specific transaction status string to
// the internal PaymentStatus enum.
func mapProviderStatus(status string) model.PaymentStatus {
	switch status {
	case "settlement", "capture", "paid":
		return model.PaymentStatusPaid
	case "deny", "cancel", "expire", "failed":
		return model.PaymentStatusFailed
	case "refund":
		return model.PaymentStatusRefunded
	default:
		return model.PaymentStatusPending
	}
}
