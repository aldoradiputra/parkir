package cloud

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all configuration values for the cloud server,
// loaded from environment variables with sensible defaults.
type Config struct {
	// Port is the HTTP listen port. Default: 8080.
	Port int

	// DatabaseURL is the PostgreSQL connection string.
	// Example: postgres://user:pass@host:5432/supapark?sslmode=disable
	DatabaseURL string

	// JWTSecret is the HMAC key used to sign and verify admin JWT tokens.
	JWTSecret string

	// QRISProviderType selects the QRIS payment provider implementation.
	// Supported values: "stub", "interactive".
	QRISProviderType string

	// WebhookSecret is the shared secret used to verify inbound QRIS webhook
	// signatures.
	WebhookSecret string

	// WhatsAppAPIKey is the API key for the WhatsApp notification provider.
	WhatsAppAPIKey string

	// TelegramBotToken is the bot token for the Telegram notification provider.
	TelegramBotToken string
}

// LoadConfig reads configuration from environment variables.
// It returns an error only when a required variable is missing or invalid.
func LoadConfig() (Config, error) {
	port := 8080
	if v := os.Getenv("PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return Config{}, fmt.Errorf("invalid PORT %q: %w", v, err)
		}
		port = p
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}

	qrisProvider := os.Getenv("QRIS_PROVIDER_TYPE")
	if qrisProvider == "" {
		qrisProvider = "stub"
	}

	webhookSecret := os.Getenv("WEBHOOK_SECRET")
	if webhookSecret == "" {
		webhookSecret = "changeme"
	}

	return Config{
		Port:             port,
		DatabaseURL:      dbURL,
		JWTSecret:        jwtSecret,
		QRISProviderType: qrisProvider,
		WebhookSecret:    webhookSecret,
		WhatsAppAPIKey:   os.Getenv("WHATSAPP_API_KEY"),
		TelegramBotToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
	}, nil
}

// Addr returns the address string suitable for http.Server.Addr.
func (c Config) Addr() string {
	return fmt.Sprintf(":%d", c.Port)
}
