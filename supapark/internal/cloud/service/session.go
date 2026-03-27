package service

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/aldoradiputra/supapark/pkg/dto"
	"github.com/aldoradiputra/supapark/pkg/errx"
	"github.com/aldoradiputra/supapark/pkg/model"
)

// SessionRepo defines the persistence operations required by SessionService.
type SessionRepo interface {
	Create(ctx context.Context, session *model.ParkingSession) error
	GetByID(ctx context.Context, id string) (*model.ParkingSession, error)
	FindActiveByPlateAndLocation(ctx context.Context, plateNormalized, locationID string) (*model.ParkingSession, error)
	FindActiveByPlate(ctx context.Context, plateNormalized string) (*model.ParkingSession, error)
	Update(ctx context.Context, session *model.ParkingSession) error
	List(ctx context.Context, locationID string, limit, offset int) ([]model.ParkingSession, int, error)
}

// VehicleRepo defines the persistence operations for vehicles.
type VehicleRepo interface {
	Upsert(ctx context.Context, vehicle *model.Vehicle) (*model.Vehicle, error)
	FindByPlateNormalized(ctx context.Context, plateNormalized string) (*model.Vehicle, error)
	LinkPhone(ctx context.Context, plateNormalized, phone string) error
}

// MemberRepo defines the persistence operations for membership checks.
type MemberRepo interface {
	IsActiveMember(ctx context.Context, locationID, vehicleID string, at time.Time) (bool, error)
}

// TariffRepo defines the persistence operations for tariff configuration.
type TariffRepo interface {
	FindByLocationAndType(ctx context.Context, locationID string, vehicleType model.VehicleType) (*model.TariffConfig, error)
}

// QRISCreator creates QRIS payment codes inline during exit processing.
type QRISCreator interface {
	CreateQRIS(ctx context.Context, sessionID string, amount int) (*dto.CreateQRISResponse, error)
}

// SessionService implements parking session business logic.
type SessionService struct {
	sessionRepo  SessionRepo
	vehicleRepo  VehicleRepo
	memberRepo   MemberRepo
	tariffRepo   TariffRepo
	qrisCreator  QRISCreator
	logger       *slog.Logger
}

// NewSessionService creates a new SessionService with the required dependencies.
func NewSessionService(
	sessionRepo SessionRepo,
	vehicleRepo VehicleRepo,
	memberRepo MemberRepo,
	tariffRepo TariffRepo,
	qrisCreator QRISCreator,
	logger *slog.Logger,
) *SessionService {
	return &SessionService{
		sessionRepo:  sessionRepo,
		vehicleRepo:  vehicleRepo,
		memberRepo:   memberRepo,
		tariffRepo:   tariffRepo,
		qrisCreator:  qrisCreator,
		logger:       logger,
	}
}

// ReportEntry processes a vehicle entry, upserts the vehicle record, and creates
// a new parking session.
func (s *SessionService) ReportEntry(ctx context.Context, req dto.EntryRequest) (*dto.EntryResponse, error) {
	plateNorm := NormalizePlate(req.Plate)

	vehicle, err := s.vehicleRepo.Upsert(ctx, &model.Vehicle{
		Plate:           req.Plate,
		PlateNormalized: plateNorm,
		VehicleType:     req.VehicleType,
		LastSeen:        time.Now(),
	})
	if err != nil {
		s.logger.Error("failed to upsert vehicle", "plate", plateNorm, "error", err)
		return nil, fmt.Errorf("upsert vehicle: %w", err)
	}

	isMember, err := s.memberRepo.IsActiveMember(ctx, req.LocationID, vehicle.ID, time.Now())
	if err != nil {
		s.logger.Warn("failed to check membership, assuming non-member", "vehicle_id", vehicle.ID, "error", err)
		isMember = false
	}

	now := time.Now()
	session := &model.ParkingSession{
		LocationID:      req.LocationID,
		VehicleID:       vehicle.ID,
		EntryLaneID:     req.LaneID,
		Plate:           req.Plate,
		PlateNormalized: plateNorm,
		VehicleType:     req.VehicleType,
		EntryPhoto:      req.Photo,
		EntryTime:       now,
		IsMember:        isMember,
		PaymentStatus:   model.PaymentStatusPending,
		SessionStatus:   model.SessionStatusActive,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		s.logger.Error("failed to create session", "plate", plateNorm, "error", err)
		return nil, fmt.Errorf("create session: %w", err)
	}

	s.logger.Info("entry recorded",
		"session_id", session.ID,
		"plate", plateNorm,
		"is_member", isMember,
	)

	resp := &dto.EntryResponse{
		SessionID:   session.ID,
		Plate:       session.Plate,
		VehicleType: session.VehicleType,
		IsMember:    session.IsMember,
		EntryTime:   session.EntryTime,
	}

	// Include phone so edge can cache it for offline exit notifications
	if vehicle.Phone != nil && *vehicle.Phone != "" {
		resp.Phone = vehicle.Phone
	}

	return resp, nil
}

// ReportExit processes a vehicle exit, calculates the tariff, and updates the
// parking session accordingly. Members park for free.
func (s *SessionService) ReportExit(ctx context.Context, req dto.ExitRequest) (*dto.ExitResponse, error) {
	session, err := s.sessionRepo.GetByID(ctx, req.SessionID)
	if err != nil {
		return nil, errx.NotFound("session not found")
	}

	if session.SessionStatus != model.SessionStatusActive {
		return nil, errx.Conflict("session is not active")
	}

	now := time.Now()
	durationMin := int(math.Ceil(now.Sub(session.EntryTime).Minutes()))
	if durationMin < 0 {
		durationMin = 0
	}

	tariffConfig, err := s.tariffRepo.FindByLocationAndType(ctx, session.LocationID, session.VehicleType)
	if err != nil {
		s.logger.Error("failed to find tariff config", "location_id", session.LocationID, "vehicle_type", session.VehicleType, "error", err)
		return nil, fmt.Errorf("find tariff config: %w", err)
	}

	tariffAmount := CalculateTariff(tariffConfig, durationMin)

	session.ExitLaneID = &req.LaneID
	session.ExitPhoto = req.Photo
	session.ExitTime = &now
	session.DurationMinutes = &durationMin
	session.TariffAmount = &tariffAmount
	session.SessionStatus = model.SessionStatusCompleted
	session.UpdatedAt = now

	if session.IsMember {
		tariffAmount = 0
		session.TariffAmount = &tariffAmount
		memberMethod := model.PaymentMethodMember
		session.PaymentMethod = &memberMethod
		session.PaymentStatus = model.PaymentStatusPaid
	}

	if err := s.sessionRepo.Update(ctx, session); err != nil {
		s.logger.Error("failed to update session on exit", "session_id", session.ID, "error", err)
		return nil, fmt.Errorf("update session: %w", err)
	}

	s.logger.Info("exit recorded",
		"session_id", session.ID,
		"plate", session.PlateNormalized,
		"duration_min", durationMin,
		"tariff", tariffAmount,
		"is_member", session.IsMember,
	)

	exitResp := &dto.ExitResponse{
		SessionID:       session.ID,
		Plate:           session.Plate,
		VehicleType:     session.VehicleType,
		EntryTime:       session.EntryTime,
		ExitTime:        now,
		DurationMinutes: durationMin,
		TariffAmount:    tariffAmount,
		IsMember:        session.IsMember,
		PaymentStatus:   session.PaymentStatus,
	}

	// Inline QRIS generation: if payment is needed, create QR code now
	if !session.IsMember && session.PaymentStatus != model.PaymentStatusPaid && tariffAmount > 0 && s.qrisCreator != nil {
		qrisResp, err := s.qrisCreator.CreateQRIS(ctx, session.ID, tariffAmount)
		if err != nil {
			s.logger.Warn("inline QRIS creation failed, edge will fall back", "session_id", session.ID, "error", err)
		} else {
			exitResp.QRString = &qrisResp.QRString
			exitResp.QRURL = qrisResp.QRURL
			exitResp.PaymentID = &qrisResp.PaymentID
		}
	}

	return exitResp, nil
}

// CalculateTariff computes the parking fee based on tariff configuration and
// parking duration in minutes. It applies the grace period, first hour rate,
// per-additional-hour rate, and daily cap.
func CalculateTariff(tariffConfig *model.TariffConfig, durationMin int) int {
	if durationMin <= tariffConfig.GracePeriodMin {
		return 0
	}

	total := tariffConfig.FirstHourRate

	if durationMin > 60 {
		extraMin := durationMin - 60
		extraHours := int(math.Ceil(float64(extraMin) / 60.0))
		total += extraHours * tariffConfig.NextHourRate
	}

	if tariffConfig.MaxDailyRate != nil && total > *tariffConfig.MaxDailyRate {
		total = *tariffConfig.MaxDailyRate
	}

	return total
}

// List returns paginated parking sessions for a given location.
func (s *SessionService) List(ctx context.Context, locationID string, limit, offset int) ([]model.ParkingSession, int, error) {
	sessions, total, err := s.sessionRepo.List(ctx, locationID, limit, offset)
	if err != nil {
		s.logger.Error("failed to list sessions", "location_id", locationID, "error", err)
		return nil, 0, fmt.Errorf("list sessions: %w", err)
	}
	return sessions, total, nil
}

// NormalizePlate converts a license plate to a canonical form by uppercasing
// and removing all spaces and dashes.
func NormalizePlate(plate string) string {
	plate = strings.ToUpper(plate)
	plate = strings.ReplaceAll(plate, " ", "")
	plate = strings.ReplaceAll(plate, "-", "")
	return plate
}
