package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"github.com/aldoradiputra/supapark/pkg/model"
)

type contextKey string

const (
	UserClaimsKey contextKey = "user_claims"
	LaneInfoKey   contextKey = "lane_info"
)

type UserClaims struct {
	UserID string
	Role   string
}

type LaneInfo struct {
	LaneID     string
	LocationID string
}

// LaneRepository is the minimal interface needed by the LaneAuth middleware.
type LaneRepository interface {
	FindByAPIKey(ctx context.Context, apiKey string) (*model.Lane, error)
}

// JWTAuth returns a middleware that validates a Bearer JWT token and stores
// UserClaims in the request context.
func JWTAuth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, `{"error":"invalid authorization header format"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := parts[1]

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			userID, _ := claims["sub"].(string)
			role, _ := claims["role"].(string)

			if userID == "" {
				http.Error(w, `{"error":"missing subject in token"}`, http.StatusUnauthorized)
				return
			}

			uc := &UserClaims{
				UserID: userID,
				Role:   role,
			}

			ctx := context.WithValue(r.Context(), UserClaimsKey, uc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// LaneAuth returns a middleware that reads the X-API-Key header, looks up the
// lane via the provided repository, and stores LaneInfo in the request context.
func LaneAuth(laneRepo LaneRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				http.Error(w, `{"error":"missing X-API-Key header"}`, http.StatusUnauthorized)
				return
			}

			lane, err := laneRepo.FindByAPIKey(r.Context(), apiKey)
			if err != nil {
				http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
				return
			}
			if lane == nil {
				http.Error(w, `{"error":"invalid API key"}`, http.StatusUnauthorized)
				return
			}

			info := &LaneInfo{
				LaneID:     lane.ID,
				LocationID: lane.LocationID,
			}

			ctx := context.WithValue(r.Context(), LaneInfoKey, info)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
