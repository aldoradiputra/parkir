package cloud

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aldoradiputra/supapark/internal/cloud/handler"
	"github.com/aldoradiputra/supapark/internal/cloud/middleware"
	"github.com/aldoradiputra/supapark/internal/cloud/repository"
	"github.com/aldoradiputra/supapark/internal/cloud/service"
	"github.com/aldoradiputra/supapark/internal/cloud/websocket"
)

type Server struct {
	cfg    Config
	pool   *pgxpool.Pool
	router chi.Router
	hub    *websocket.Hub
	logger *slog.Logger
}

func NewServer(cfg Config, logger *slog.Logger) (*Server, error) {
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	hub := websocket.NewHub(logger)
	go hub.Run()

	s := &Server{
		cfg:    cfg,
		pool:   pool,
		router: chi.NewRouter(),
		hub:    hub,
		logger: logger,
	}

	s.registerRoutes()
	return s, nil
}

func (s *Server) registerRoutes() {
	r := s.router

	// Global middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(corsMiddleware)

	// Repositories
	sessionRepo := repository.NewSessionRepo(s.pool)
	paymentRepo := repository.NewPaymentRepo(s.pool)
	vehicleRepo := repository.NewVehicleRepo(s.pool)
	locationRepo := repository.NewLocationRepo(s.pool)
	laneRepo := repository.NewLaneRepo(s.pool)
	userRepo := repository.NewUserRepo(s.pool)
	memberRepo := repository.NewMemberRepo(s.pool)
	tariffRepo := repository.NewTariffRepo(s.pool)

	// Services
	var qrisProvider service.QRISProvider = service.NewStubQRIS(s.logger)
	notifier := service.NewStubNotifier(s.logger)

	paymentSvc := service.NewPaymentService(paymentRepo, sessionRepo, qrisProvider, notifier, s.hub, s.logger)
	sessionSvc := service.NewSessionService(sessionRepo, vehicleRepo, memberRepo, tariffRepo, paymentSvc, s.logger)

	// Handlers
	healthH := handler.NewHealthHandler()
	authH := handler.NewAuthHandler(userRepo, s.cfg.JWTSecret, s.logger)
	sessionH := handler.NewSessionHandler(sessionSvc, s.logger)
	paymentH := handler.NewPaymentHandler(paymentSvc, s.cfg.WebhookSecret, s.logger)
	vehicleH := handler.NewVehicleHandler(vehicleRepo, sessionRepo, paymentSvc, s.logger)
	syncH := handler.NewSyncHandler(s.logger)

	// Auth middleware
	jwtAuth := middleware.JWTAuth(s.cfg.JWTSecret)
	laneAuth := middleware.LaneAuth(laneRepo)

	// Routes
	r.Get("/api/v1/health", healthH.Health)

	r.Route("/api/v1/auth", func(r chi.Router) {
		r.Post("/login", authH.Login)
	})

	r.Route("/api/v1/sessions", func(r chi.Router) {
		r.Use(laneAuth)
		r.Post("/entry", sessionH.ReportEntry)
		r.Post("/exit", sessionH.ReportExit)
	})

	r.Route("/api/v1/payments", func(r chi.Router) {
		r.Use(laneAuth)
		r.Post("/qris/create", paymentH.CreateQRIS)
		r.Get("/{sessionID}/status", paymentH.GetStatus)
	})

	r.Post("/api/v1/webhooks/qris", paymentH.HandleWebhook)

	r.Route("/api/v1/sync", func(r chi.Router) {
		r.Use(laneAuth)
		r.Post("/sessions", syncH.HandleSessionSync)
	})

	r.Route("/api/v1/vehicles", func(r chi.Router) {
		r.Post("/link", vehicleH.LinkPhone)
		r.Get("/{plate}/session", vehicleH.GetActiveSession)
		r.Post("/{plate}/prepay", vehicleH.Prepay)
	})

	r.Route("/api/v1/admin", func(r chi.Router) {
		r.Use(jwtAuth)
		r.Get("/locations", handler.NewLocationHandler(locationRepo, s.logger).List)
		r.Get("/sessions", sessionH.List)
	})

	r.Get("/ws", s.hub.HandleUpgrade)

	_ = notifier
}

func (s *Server) Start() error {
	srv := &http.Server{
		Addr:         s.cfg.Addr(),
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	s.logger.Info("cloud server starting", "addr", s.cfg.Addr())
	return srv.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) {
	s.pool.Close()
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
