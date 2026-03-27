package handler

import (
	"encoding/json"
	"net/http"

	"github.com/aldoradiputra/supapark/pkg/dto"
)

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, dto.ErrorResponse{
		Code:    status,
		Message: message,
	})
}
