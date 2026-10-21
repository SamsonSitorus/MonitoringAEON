package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"camtrack-backend/db"

	"github.com/labstack/echo/v4"
)

type ReportHandler struct{}

func NewReportHandler() *ReportHandler {
	return &ReportHandler{}
}

func (h *ReportHandler) ExportCSV(c echo.Context) error {
	query := `
		SELECT 
			r.id, r.task_id, c.code, c.name, COALESCE(c.system, 'InaAI'), COALESCE(c.nvr, ''), COALESCE(c.channel_no, 1),
			u.name as inspector_name, ft.name as template_name, ftv.version_number,
			COALESCE(r.target_date::text, ''), COALESCE(r.target_time_slot, ''),
			r.review_status, COALESCE(r.notes, ''), r.payload::text, r.submitted_at
		FROM inspection_records r
		JOIN cameras c ON r.camera_id = c.id
		JOIN users u ON r.inspector_id = u.id
		JOIN form_template_versions ftv ON r.template_version_id = ftv.id
		JOIN form_templates ft ON ftv.template_id = ft.id
		ORDER BY r.target_date DESC, r.target_time_slot ASC, r.submitted_at DESC
	`

	rows, err := db.Pool.Query(context.Background(), query)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// CSV Header
	header := []string{
		"Record ID", "Task ID", "Camera Code", "Camera Name", "Sistem", "NVR", "Channel",
		"Inspector", "Template Name", "Form Version", "Tanggal Target", "Slot Jam Target", "Review Status",
		"Inspector Notes", "Observation Data (JSON)", "Submitted At",
	}
	if err := writer.Write(header); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	for rows.Next() {
		var (
			recID, taskID, camCode, camName, camSys, camNVR string
			camChannel                                      int
			inspectorName, tmplName                         string
			verNum                                          int
			targetDate, targetTimeSlot                      string
			reviewStatus, notes, payload                    string
			subAt                                           time.Time
		)
		if err := rows.Scan(
			&recID, &taskID, &camCode, &camName, &camSys, &camNVR, &camChannel,
			&inspectorName, &tmplName, &verNum,
			&targetDate, &targetTimeSlot,
			&reviewStatus, &notes, &payload, &subAt,
		); err != nil {
			continue
		}

		timeSlot := targetTimeSlot
		if timeSlot == "" {
			var pData map[string]any
			if err := json.Unmarshal([]byte(payload), &pData); err == nil {
				if ts, ok := pData["observation_time_slot"].(string); ok && ts != "" {
					timeSlot = ts
				}
			}
		}
		if timeSlot == "" {
			timeSlot = "-"
		}

		row := []string{
			recID, taskID, camCode, camName, camSys, camNVR, fmt.Sprintf("Ch %d", camChannel),
			inspectorName, tmplName, fmt.Sprintf("v%d", verNum),
			targetDate, timeSlot, reviewStatus, notes, payload, subAt.Format(time.RFC3339),
		}
		_ = writer.Write(row)
	}

	writer.Flush()

	filename := fmt.Sprintf("camtrack_inspections_%s.csv", time.Now().Format("20060102_150405"))
	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=%q", filename))
	return c.Blob(http.StatusOK, "text/csv", buf.Bytes())
}
