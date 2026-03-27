package edge

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration values for the edge service,
// loaded from environment variables with sensible defaults.
type Config struct {
	// CloudURL is the base URL of the cloud API (e.g. https://api.supapark.id).
	CloudURL string

	// APIKey is the lane API key used for authentication against the cloud.
	APIKey string

	// LocationID identifies the parking location this edge device belongs to.
	LocationID string

	// LaneID identifies the specific lane this edge device controls.
	LaneID string

	// LaneMode is either "entry" or "exit".
	LaneMode string

	// RTSPUrl is the RTSP stream URL of the lane camera.
	RTSPUrl string

	// ALPRScriptPath is the filesystem path to the Python ALPR script.
	ALPRScriptPath string

	// ALPRMock, when true, uses a mock ALPR that returns random plates.
	ALPRMock bool

	// RelayType selects the barrier relay driver: "gpio", "usb", or "mock".
	RelayType string

	// GPIOOpenPin is the GPIO pin number used to open the barrier gate.
	GPIOOpenPin int

	// GPIOClosePin is the GPIO pin number used to close the barrier gate.
	GPIOClosePin int

	// USBRelayPort is the serial port path for USB relay control.
	USBRelayPort string

	// LocalDBPath is the filesystem path to the BoltDB database.
	LocalDBPath string

	// HTTPPort is the local HTTP server listen port. Default: 8080.
	HTTPPort int

	// Debug enables verbose logging.
	Debug bool
}

// LoadConfig reads configuration from environment variables and applies defaults.
func LoadConfig() Config {
	cfg := Config{
		CloudURL:       envOrDefault("EDGE_CLOUD_URL", "http://localhost:8080"),
		APIKey:         envOrDefault("EDGE_API_KEY", ""),
		LocationID:     envOrDefault("EDGE_LOCATION_ID", ""),
		LaneID:         envOrDefault("EDGE_LANE_ID", ""),
		LaneMode:       envOrDefault("EDGE_LANE_MODE", "entry"),
		RTSPUrl:        envOrDefault("EDGE_RTSP_URL", ""),
		ALPRScriptPath: envOrDefault("EDGE_ALPR_SCRIPT", "./scripts/alpr.py"),
		ALPRMock:       envOrDefault("EDGE_ALPR_MOCK", "true") == "true",
		RelayType:      envOrDefault("EDGE_RELAY_TYPE", "mock"),
		USBRelayPort:   envOrDefault("EDGE_USB_RELAY_PORT", "/dev/ttyUSB0"),
		LocalDBPath:    envOrDefault("EDGE_DB_PATH", "./edge.db"),
		Debug:          envOrDefault("EDGE_DEBUG", "false") == "true",
	}

	cfg.HTTPPort = envIntOrDefault("EDGE_HTTP_PORT", 8080)
	cfg.GPIOOpenPin = envIntOrDefault("EDGE_GPIO_OPEN_PIN", 17)
	cfg.GPIOClosePin = envIntOrDefault("EDGE_GPIO_CLOSE_PIN", 27)

	return cfg
}

// Addr returns the listen address string suitable for http.Server.
func (c Config) Addr() string {
	return fmt.Sprintf(":%d", c.HTTPPort)
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envIntOrDefault(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
