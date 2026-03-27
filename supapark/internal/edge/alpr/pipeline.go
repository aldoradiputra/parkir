package alpr

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"os/exec"
	"strings"
)

// PlateResult holds the output of a license plate recognition attempt.
type PlateResult struct {
	Plate       string  `json:"plate"`
	Confidence  float64 `json:"confidence"`
	VehicleType string  `json:"vehicle_type"` // "car" or "motorcycle"
}

// Pipeline wraps either a real Python ALPR script or a mock recogniser.
type Pipeline struct {
	scriptPath string
	mock       bool
	logger     *slog.Logger
}

// NewPipeline creates an ALPRPipeline.
// When mock is true the script path is ignored and random plates are returned.
func NewPipeline(scriptPath string, mock bool, logger *slog.Logger) *Pipeline {
	return &Pipeline{
		scriptPath: scriptPath,
		mock:       mock,
		logger:     logger.With("component", "alpr"),
	}
}

// Recognize performs plate recognition.
// In mock mode it returns a random Indonesian-format plate.
// Otherwise it executes the external Python script and parses its JSON output.
func (p *Pipeline) Recognize(ctx context.Context) (*PlateResult, error) {
	if p.mock {
		return p.mockRecognize(), nil
	}
	return p.realRecognize(ctx)
}

// mockRecognize generates a random Indonesian licence plate (B 1234 ABC format).
func (p *Pipeline) mockRecognize() *PlateResult {
	prefixes := []string{"B", "D", "F", "L", "N", "AB", "AD", "AG", "BK", "BL"}
	prefix := prefixes[rand.Intn(len(prefixes))]
	num := 1000 + rand.Intn(9000)

	suffixLen := 1 + rand.Intn(3)
	var sb strings.Builder
	for i := 0; i < suffixLen; i++ {
		sb.WriteByte(byte('A' + rand.Intn(26)))
	}
	suffix := sb.String()

	plate := fmt.Sprintf("%s %d %s", prefix, num, suffix)
	vType := "car"
	if rand.Intn(3) == 0 {
		vType = "motorcycle"
	}

	p.logger.Info("mock ALPR recognition", "plate", plate, "vehicle_type", vType)

	return &PlateResult{
		Plate:       plate,
		Confidence:  0.92,
		VehicleType: vType,
	}
}

// realRecognize invokes the external Python ALPR script and parses its output.
func (p *Pipeline) realRecognize(ctx context.Context) (*PlateResult, error) {
	cmd := exec.CommandContext(ctx, "python3", p.scriptPath, "capture")

	p.logger.Info("running ALPR script", "script", p.scriptPath)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("execute ALPR script: %w", err)
	}

	var result PlateResult
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("parse ALPR output: %w (raw: %s)", err, string(output))
	}

	if result.Plate == "" {
		return nil, fmt.Errorf("ALPR returned empty plate")
	}

	p.logger.Info("ALPR recognition complete",
		"plate", result.Plate,
		"confidence", result.Confidence,
		"vehicle_type", result.VehicleType,
	)

	return &result, nil
}
