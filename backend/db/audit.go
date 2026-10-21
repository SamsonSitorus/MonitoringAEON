package db

import (
	"context"
	"encoding/json"
	"log"

	"github.com/google/uuid"
)

// LogAudit records an audit log entry in audit_logs table asynchronously
func LogAudit(ctx context.Context, userID, action, targetType, targetID string, details any) {
	if Pool == nil {
		return
	}

	auditID := "aud-" + uuid.New().String()[:8]
	var detailsBytes []byte
	if details != nil {
		var err error
		detailsBytes, err = json.Marshal(details)
		if err != nil {
			detailsBytes = []byte("{}")
		}
	} else {
		detailsBytes = []byte("{}")
	}

	query := `
		INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, created_at)
		VALUES ($1, NULLIF($2, ''), $3, $4, NULLIF($5, ''), $6, NOW())
	`

	go func() {
		bgCtx := context.Background()
		_, err := Pool.Exec(bgCtx, query, auditID, userID, action, targetType, targetID, detailsBytes)
		if err != nil {
			log.Printf("[AUDIT ERROR] Failed to record audit log [%s - %s]: %v", action, targetType, err)
		}
	}()
}
