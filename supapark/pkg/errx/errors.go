package errx

import (
	"errors"
	"fmt"
	"net/http"
)

// Sentinel errors for domain-level error matching.
var (
	ErrNotFound      = errors.New("not found")
	ErrConflict      = errors.New("conflict")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrBadRequest    = errors.New("bad request")
	ErrPaymentFailed = errors.New("payment failed")
)

// AppError wraps a sentinel with context so handlers can extract an HTTP status
// and a user-facing message while preserving errors.Is() semantics.
type AppError struct {
	Err     error  // sentinel (ErrNotFound, etc.)
	Message string // human-readable detail
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Err.Error(), e.Message)
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// ---------- Constructors ----------

func NotFound(msg string) *AppError {
	return &AppError{Err: ErrNotFound, Message: msg}
}

func Conflict(msg string) *AppError {
	return &AppError{Err: ErrConflict, Message: msg}
}

func Unauthorized(msg string) *AppError {
	return &AppError{Err: ErrUnauthorized, Message: msg}
}

func BadRequest(msg string) *AppError {
	return &AppError{Err: ErrBadRequest, Message: msg}
}

func PaymentFailed(msg string) *AppError {
	return &AppError{Err: ErrPaymentFailed, Message: msg}
}

// HTTPStatus maps a domain error to the appropriate HTTP status code.
func HTTPStatus(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrConflict):
		return http.StatusConflict
	case errors.Is(err, ErrUnauthorized):
		return http.StatusUnauthorized
	case errors.Is(err, ErrBadRequest):
		return http.StatusBadRequest
	case errors.Is(err, ErrPaymentFailed):
		return http.StatusPaymentRequired
	default:
		return http.StatusInternalServerError
	}
}
