package main

import (
	"context"
	"io/fs"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/aldoradiputra/supapark/internal/edge"
	"github.com/aldoradiputra/supapark/web"
)

func main() {
	level := slog.LevelInfo
	if os.Getenv("EDGE_DEBUG") == "true" {
		level = slog.LevelDebug
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))

	cfg := edge.LoadConfig()

	var screenFS fs.FS
	var screenErr error
	if cfg.LaneMode == "entry" {
		screenFS, screenErr = fs.Sub(web.EntryScreenFS, "entry-screen")
	} else {
		screenFS, screenErr = fs.Sub(web.ExitScreenFS, "exit-screen")
	}
	if screenErr != nil {
		logger.Error("prepare screen fs", "mode", cfg.LaneMode, "err", screenErr)
		os.Exit(1)
	}

	srv, err := edge.NewServer(cfg, screenFS, logger)
	if err != nil {
		logger.Error("create edge server", "err", err)
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	go func() {
		if err := srv.Start(ctx); err != nil {
			logger.Error("edge server stopped", "err", err)
			cancel()
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down edge...")
	srv.Shutdown()
	logger.Info("goodbye")
}
