package edge

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"time"

	"github.com/aldoradiputra/supapark/internal/edge/alpr"
	"github.com/aldoradiputra/supapark/internal/edge/detector"
	"github.com/aldoradiputra/supapark/internal/edge/gate"
	"github.com/aldoradiputra/supapark/internal/edge/pwa"
	"github.com/aldoradiputra/supapark/internal/edge/session"
	"github.com/aldoradiputra/supapark/internal/edge/sync"
)

// Server is the edge HTTP server that serves the exit screen PWA and
// coordinates the detector loop, gate control, and sync engine.
type Server struct {
	cfg       Config
	webFS     fs.FS
	store     *session.Store
	gate      gate.Gate
	pipeline  *alpr.Pipeline
	syncEng   *sync.Engine
	sseBroker *pwa.SSEBroker
	loop      *detector.Loop
	mux       *http.ServeMux
	logger    *slog.Logger
}

// NewServer creates and wires the edge server. webFS should be the exit-screen
// PWA filesystem (typically from go:embed in cmd/edge/main.go).
func NewServer(cfg Config, webFS fs.FS, logger *slog.Logger) (*Server, error) {
	store, err := session.NewStore(cfg.LocalDBPath)
	if err != nil {
		return nil, err
	}

	g := gate.Gate(gate.NewMockGate(logger))

	pipeline := alpr.NewPipeline(cfg.ALPRScriptPath, cfg.ALPRMock, logger)
	syncEng := sync.NewEngine(cfg.CloudURL, cfg.APIKey, store, logger)
	sseBroker := pwa.NewSSEBroker(logger)

	loopCfg := detector.Config{
		LaneMode:     cfg.LaneMode,
		LaneID:       cfg.LaneID,
		LocationID:   cfg.LocationID,
		CloudURL:     cfg.CloudURL,
		APIKey:       cfg.APIKey,
		PollInterval: 3 * time.Second,
	}

	loop := detector.NewLoop(loopCfg, pipeline, g, store, syncEng, sseBroker, logger)

	mux := http.NewServeMux()

	s := &Server{
		cfg:       cfg,
		webFS:     webFS,
		store:     store,
		gate:      g,
		pipeline:  pipeline,
		syncEng:   syncEng,
		sseBroker: sseBroker,
		loop:      loop,
		mux:       mux,
		logger:    logger,
	}

	s.registerRoutes()
	return s, nil
}

func (s *Server) registerRoutes() {
	// SSE endpoint for exit screen
	s.mux.Handle("/events", s.sseBroker)

	// Health check
	s.mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","gate":"` + s.gate.State() + `","online":` +
			boolStr(s.syncEng.IsOnline()) + `}`))
	})

	// Gate status
	s.mux.HandleFunc("/gate/state", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"state":"` + s.gate.State() + `"}`))
	})

	// Serve exit screen PWA static files
	if s.webFS != nil {
		s.mux.Handle("/", http.FileServer(http.FS(s.webFS)))
	}
}

// Start begins the edge server, sync engine, and detector loop.
func (s *Server) Start(ctx context.Context) error {
	// Start sync engine
	go s.syncEng.Run(ctx, 15*time.Second)

	// Start detector loop
	go s.loop.Run(ctx)

	srv := &http.Server{
		Addr:         s.cfg.Addr(),
		Handler:      s.mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // SSE needs no write timeout
		IdleTimeout:  60 * time.Second,
	}

	s.logger.Info("edge server starting", "addr", s.cfg.Addr())
	return srv.ListenAndServe()
}

// Shutdown releases edge resources.
func (s *Server) Shutdown() {
	s.store.Close()
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
