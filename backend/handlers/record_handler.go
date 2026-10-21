package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"camtrack-backend/db"
	"camtrack-backend/middleware"
	"camtrack-backend/models"

	"github.com/labstack/echo/v4"
)

type RecordHandler struct{}

func NewRecordHandler() *RecordHandler {
	return &RecordHandler{}
}

func (h *RecordHandler) ListRecords(c echo.Context) error {
	cameraID := c.QueryParam("camera_id")
	inspectorID := c.QueryParam("inspector_id")
	reviewStatus := c.QueryParam("review_status")

	query := `
		SELECT 
			r.id, r.task_id, r.camera_id, r.inspector_id, r.template_version_id,
			r.payload, COALESCE(r.notes, ''), r.review_status, COALESCE(r.review_notes, ''), r.reviewer_id,
			COALESCE(r.target_date::text, ''), COALESCE(r.target_time_slot, ''),
			r.submitted_at, r.reviewed_at,
			c.name as camera_name, c.code as camera_code, COALESCE(c.system, 'InaAI') as camera_system, COALESCE(c.nvr, '') as camera_nvr, COALESCE(c.channel_no, 1) as camera_channel_no,
			u.name as inspector_name,
			ft.name as template_name, ftv.version_number,
			COALESCE(rev.name, '') as reviewer_name
		FROM inspection_records r
		JOIN cameras c ON r.camera_id = c.id
		JOIN users u ON r.inspector_id = u.id
		JOIN form_template_versions ftv ON r.template_version_id = ftv.id
		JOIN form_templates ft ON ftv.template_id = ft.id
		LEFT JOIN users rev ON r.reviewer_id = rev.id
		WHERE 1=1
	`
	args := make([]any, 0)
	argIdx := 1

	if cameraID != "" {
		query += fmt.Sprintf(" AND r.camera_id = $%d", argIdx)
		args = append(args, cameraID)
		argIdx++
	}
	if inspectorID != "" {
		query += fmt.Sprintf(" AND r.inspector_id = $%d", argIdx)
		args = append(args, inspectorID)
		argIdx++
	}
	if reviewStatus != "" {
		query += fmt.Sprintf(" AND r.review_status = $%d", argIdx)
		args = append(args, reviewStatus)
		argIdx++
	}

	query += " ORDER BY r.target_date DESC, r.target_time_slot ASC, r.submitted_at DESC"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	records := make([]models.InspectionRecord, 0)
	for rows.Next() {
		var r models.InspectionRecord
		if err := rows.Scan(
			&r.ID, &r.TaskID, &r.CameraID, &r.InspectorID, &r.TemplateVersionID,
			&r.Payload, &r.Notes, &r.ReviewStatus, &r.ReviewNotes, &r.ReviewerID,
			&r.TargetDate, &r.TargetTimeSlot,
			&r.SubmittedAt, &r.ReviewedAt,
			&r.CameraName, &r.CameraCode, &r.CameraSystem, &r.CameraNVR, &r.CameraChannelNo,
			&r.InspectorName,
			&r.TemplateName, &r.VersionNumber,
			&r.ReviewerName,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		records = append(records, r)
	}

	return c.JSON(http.StatusOK, records)
}

func (h *RecordHandler) GetRecord(c echo.Context) error {
	id := c.Param("id")

	query := `
		SELECT 
			r.id, r.task_id, r.camera_id, r.inspector_id, r.template_version_id,
			r.payload, COALESCE(r.notes, ''), r.review_status, COALESCE(r.review_notes, ''), r.reviewer_id,
			COALESCE(r.target_date::text, ''), COALESCE(r.target_time_slot, ''),
			r.submitted_at, r.reviewed_at,
			c.name as camera_name, c.code as camera_code, COALESCE(c.system, 'InaAI') as camera_system, COALESCE(c.nvr, '') as camera_nvr, COALESCE(c.channel_no, 1) as camera_channel_no,
			u.name as inspector_name,
			ft.name as template_name, ftv.version_number,
			COALESCE(rev.name, '') as reviewer_name
		FROM inspection_records r
		JOIN cameras c ON r.camera_id = c.id
		JOIN users u ON r.inspector_id = u.id
		JOIN form_template_versions ftv ON r.template_version_id = ftv.id
		JOIN form_templates ft ON ftv.template_id = ft.id
		LEFT JOIN users rev ON r.reviewer_id = rev.id
		WHERE r.id = $1
	`

	var r models.InspectionRecord
	err := db.Pool.QueryRow(context.Background(), query, id).Scan(
		&r.ID, &r.TaskID, &r.CameraID, &r.InspectorID, &r.TemplateVersionID,
		&r.Payload, &r.Notes, &r.ReviewStatus, &r.ReviewNotes, &r.ReviewerID,
		&r.TargetDate, &r.TargetTimeSlot,
		&r.SubmittedAt, &r.ReviewedAt,
		&r.CameraName, &r.CameraCode, &r.CameraSystem, &r.CameraNVR, &r.CameraChannelNo,
		&r.InspectorName,
		&r.TemplateName, &r.VersionNumber,
		&r.ReviewerName,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Record not found")
	}

	return c.JSON(http.StatusOK, r)
}

type ReviewRecordRequest struct {
	Status string `json:"status"` // APPROVED, REVISION_REQUESTED
	Notes  string `json:"notes"`
}

func (h *RecordHandler) ReviewRecord(c echo.Context) error {
	recordID := c.Param("id")
	var req ReviewRecordRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.Status != "APPROVED" && req.Status != "REVISION_REQUESTED" {
		return echo.NewHTTPError(http.StatusBadRequest, "Status must be APPROVED or REVISION_REQUESTED")
	}

	claims := middleware.GetUserFromContext(c)
	reviewerID := ""
	if claims != nil {
		reviewerID = claims.UserID
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback(context.Background())

	now := time.Now()
	var taskID string
	err = tx.QueryRow(context.Background(),
		`UPDATE inspection_records
		 SET review_status = $1, review_notes = $2, reviewer_id = $3, reviewed_at = $4
		 WHERE id = $5
		 RETURNING task_id`,
		req.Status, req.Notes, reviewerID, now, recordID,
	).Scan(&taskID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Record not found or update failed: "+err.Error())
	}

	// If revision requested, reopen the task to REVISION_NEEDED
	if req.Status == "REVISION_REQUESTED" {
		_, err = tx.Exec(context.Background(),
			`UPDATE inspection_tasks SET status = 'REVISION_NEEDED' WHERE id = $1`,
			taskID,
		)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update task status: "+err.Error())
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Commit failed: "+err.Error())
	}

	action := "APPROVE_INSPECTION"
	if req.Status == "REVISION_REQUESTED" {
		action = "REQUEST_REVISION"
	}
	db.LogAudit(context.Background(), reviewerID, action, "RECORD", recordID, map[string]any{
		"record_id":     recordID,
		"task_id":       taskID,
		"review_status": req.Status,
		"notes":         req.Notes,
	})

	return c.JSON(http.StatusOK, map[string]any{
		"message":       "Review submitted successfully",
		"record_id":     recordID,
		"review_status": req.Status,
		"reviewed_at":   now,
	})
}
