package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"camtrack-backend/db"
	"camtrack-backend/middleware"
	"camtrack-backend/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type TaskHandler struct{}

func NewTaskHandler() *TaskHandler {
	return &TaskHandler{}
}

func (h *TaskHandler) ListTasks(c echo.Context) error {
	assignedTo := c.QueryParam("assigned_to")
	status := c.QueryParam("status")
	cameraID := c.QueryParam("camera_id")
	targetDate := c.QueryParam("target_date")

	claims := middleware.GetUserFromContext(c)
	// If inspector, restrict to their own tasks unless explicitly supervisor/admin
	if claims != nil && claims.Role == models.RoleInspector {
		assignedTo = claims.UserID
	}

	query := `
		SELECT 
			t.id, t.camera_id, t.assigned_user_id, t.template_version_id, t.status, 
			t.draft_data, COALESCE(t.target_date::text, ''), COALESCE(t.target_time_slot, ''),
			t.due_date, t.completed_at, t.created_at,
			c.name as camera_name, c.code as camera_code, COALESCE(c.system, 'InaAI') as camera_system, COALESCE(c.nvr, '') as camera_nvr, COALESCE(c.channel_no, 1) as camera_channel_no,
			u.name as assigned_user_name,
			ft.name as template_name, ftv.version_number
		FROM inspection_tasks t
		JOIN cameras c ON t.camera_id = c.id
		JOIN users u ON t.assigned_user_id = u.id
		JOIN form_template_versions ftv ON t.template_version_id = ftv.id
		JOIN form_templates ft ON ftv.template_id = ft.id
		WHERE 1=1
	`
	args := make([]any, 0)
	argIdx := 1

	if assignedTo != "" {
		query += fmt.Sprintf(" AND t.assigned_user_id = $%d", argIdx)
		args = append(args, assignedTo)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND t.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if cameraID != "" {
		query += fmt.Sprintf(" AND t.camera_id = $%d", argIdx)
		args = append(args, cameraID)
		argIdx++
	}
	if targetDate != "" {
		query += fmt.Sprintf(" AND t.target_date = $%d", argIdx)
		args = append(args, targetDate)
		argIdx++
	}

	query += " ORDER BY t.target_date DESC, t.target_time_slot ASC, t.created_at DESC"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	tasks := make([]models.InspectionTask, 0)
	for rows.Next() {
		var t models.InspectionTask
		if err := rows.Scan(
			&t.ID, &t.CameraID, &t.AssignedUserID, &t.TemplateVersionID, &t.Status,
			&t.DraftData, &t.TargetDate, &t.TargetTimeSlot,
			&t.DueDate, &t.CompletedAt, &t.CreatedAt,
			&t.CameraName, &t.CameraCode, &t.CameraSystem, &t.CameraNVR, &t.CameraChannelNo,
			&t.AssignedUserName,
			&t.TemplateName, &t.VersionNumber,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		tasks = append(tasks, t)
	}

	return c.JSON(http.StatusOK, tasks)
}

func (h *TaskHandler) GetTask(c echo.Context) error {
	id := c.Param("id")

	query := `
		SELECT 
			t.id, t.camera_id, t.assigned_user_id, t.template_version_id, t.status, 
			t.draft_data, COALESCE(t.target_date::text, ''), COALESCE(t.target_time_slot, ''),
			t.due_date, t.completed_at, t.created_at,
			c.name as camera_name, c.code as camera_code, COALESCE(c.system, 'InaAI') as camera_system, COALESCE(c.nvr, '') as camera_nvr, COALESCE(c.channel_no, 1) as camera_channel_no,
			u.name as assigned_user_name,
			ft.name as template_name, ftv.version_number, ftv.schema_json
		FROM inspection_tasks t
		JOIN cameras c ON t.camera_id = c.id
		JOIN users u ON t.assigned_user_id = u.id
		JOIN form_template_versions ftv ON t.template_version_id = ftv.id
		JOIN form_templates ft ON ftv.template_id = ft.id
		WHERE t.id = $1
	`

	var t models.InspectionTask
	var schemaBytes []byte
	err := db.Pool.QueryRow(context.Background(), query, id).Scan(
		&t.ID, &t.CameraID, &t.AssignedUserID, &t.TemplateVersionID, &t.Status,
		&t.DraftData, &t.TargetDate, &t.TargetTimeSlot,
		&t.DueDate, &t.CompletedAt, &t.CreatedAt,
		&t.CameraName, &t.CameraCode, &t.CameraSystem, &t.CameraNVR, &t.CameraChannelNo,
		&t.AssignedUserName,
		&t.TemplateName, &t.VersionNumber, &schemaBytes,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Inspection task not found")
	}

	var schema models.FormSchema
	if err := json.Unmarshal(schemaBytes, &schema); err == nil {
		t.Schema = &schema
	}

	return c.JSON(http.StatusOK, t)
}

type CreateTaskRequest struct {
	CameraID          string `json:"camera_id"`
	AssignedUserID    string `json:"assigned_user_id"`
	TemplateVersionID string `json:"template_version_id"`
	TargetDate        string `json:"target_date,omitempty"`
	TargetTimeSlot    string `json:"target_time_slot,omitempty"`
	DueDate           string `json:"due_date,omitempty"`
}

type BatchCreateTaskRequest struct {
	CameraIDs         []string `json:"camera_ids"`
	AssignedUserID    string   `json:"assigned_user_id"`
	TemplateVersionID string   `json:"template_version_id"`
	TargetDate        string   `json:"target_date,omitempty"`
	TargetTimeSlots   []string `json:"target_time_slots,omitempty"`
	DueDate           string   `json:"due_date,omitempty"`
}

func (h *TaskHandler) CreateTask(c echo.Context) error {
	var req CreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.CameraID == "" || req.AssignedUserID == "" || req.TemplateVersionID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "CameraID, AssignedUserID, and TemplateVersionID are required")
	}

	taskID := "tsk-" + uuid.New().String()[:8]
	var due *time.Time
	if req.DueDate != "" {
		if parsed, err := time.Parse(time.RFC3339, req.DueDate); err == nil {
			due = &parsed
		}
	}

	targetDate := req.TargetDate
	if targetDate == "" {
		targetDate = time.Now().Format("2006-01-02")
	}

	draftData := "{}"
	if req.TargetTimeSlot != "" {
		draftData = fmt.Sprintf(`{"observation_time_slot": "%s"}`, req.TargetTimeSlot)
	}

	query := `
		INSERT INTO inspection_tasks (id, camera_id, assigned_user_id, template_version_id, status, target_date, target_time_slot, draft_data, due_date)
		VALUES ($1, $2, $3, $4, 'NOT_STARTED', $5, $6, $7::jsonb, $8)
		RETURNING id, camera_id, assigned_user_id, template_version_id, status, target_date::text, target_time_slot, created_at
	`
	var t models.InspectionTask
	err := db.Pool.QueryRow(context.Background(), query,
		taskID, req.CameraID, req.AssignedUserID, req.TemplateVersionID, targetDate, req.TargetTimeSlot, draftData, due,
	).Scan(&t.ID, &t.CameraID, &t.AssignedUserID, &t.TemplateVersionID, &t.Status, &t.TargetDate, &t.TargetTimeSlot, &t.CreatedAt)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create task: "+err.Error())
	}

	return c.JSON(http.StatusCreated, t)
}

func (h *TaskHandler) BatchCreateTasks(c echo.Context) error {
	var req BatchCreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if len(req.CameraIDs) == 0 || req.AssignedUserID == "" || req.TemplateVersionID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "CameraIDs, AssignedUserID, and TemplateVersionID are required")
	}

	var due *time.Time
	if req.DueDate != "" {
		if parsed, err := time.Parse(time.RFC3339, req.DueDate); err == nil {
			due = &parsed
		}
	}

	targetDate := req.TargetDate
	if targetDate == "" {
		targetDate = time.Now().Format("2006-01-02")
	}

	slots := req.TargetTimeSlots
	if len(slots) == 0 {
		slots = []string{""}
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback(context.Background())

	createdTasks := make([]string, 0)
	for _, camID := range req.CameraIDs {
		for _, slot := range slots {
			taskID := "tsk-" + uuid.New().String()[:8]
			draftData := "{}"
			if slot != "" {
				draftData = fmt.Sprintf(`{"observation_time_slot": "%s"}`, slot)
			}
			_, err := tx.Exec(context.Background(),
				`INSERT INTO inspection_tasks (id, camera_id, assigned_user_id, template_version_id, status, target_date, target_time_slot, draft_data, due_date)
				 VALUES ($1, $2, $3, $4, 'NOT_STARTED', $5, $6, $7::jsonb, $8)`,
				taskID, camID, req.AssignedUserID, req.TemplateVersionID, targetDate, slot, draftData, due,
			)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Failed creating batch task: "+err.Error())
			}
			createdTasks = append(createdTasks, taskID)
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, map[string]any{
		"message":       fmt.Sprintf("%d tasks successfully assigned", len(createdTasks)),
		"created_tasks": createdTasks,
	})
}

type SaveDraftRequest struct {
	DraftData json.RawMessage `json:"draft_data"`
}

func (h *TaskHandler) SaveDraft(c echo.Context) error {
	id := c.Param("id")
	var req SaveDraftRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	query := `
		UPDATE inspection_tasks
		SET draft_data = $1, status = 'IN_PROGRESS'
		WHERE id = $2
	`
	_, err := db.Pool.Exec(context.Background(), query, req.DraftData, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to save draft: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Draft saved successfully",
		"status":  string(models.TaskStatusInProgress),
	})
}

type SubmitInspectionRequest struct {
	Payload json.RawMessage `json:"payload"`
	Notes   string          `json:"notes"`
}

func (h *TaskHandler) SubmitTask(c echo.Context) error {
	taskID := c.Param("id")

	var req SubmitInspectionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid payload body")
	}

	claims := middleware.GetUserFromContext(c)
	inspectorID := ""
	if claims != nil {
		inspectorID = claims.UserID
	}

	// 1. Fetch task and schema to validate
	var task models.InspectionTask
	var schemaBytes []byte
	query := `
		SELECT t.id, t.camera_id, t.assigned_user_id, t.template_version_id, t.status, 
		       COALESCE(t.target_date::text, ''), COALESCE(t.target_time_slot, ''), ftv.schema_json
		FROM inspection_tasks t
		JOIN form_template_versions ftv ON t.template_version_id = ftv.id
		WHERE t.id = $1
	`
	err := db.Pool.QueryRow(context.Background(), query, taskID).Scan(
		&task.ID, &task.CameraID, &task.AssignedUserID, &task.TemplateVersionID, &task.Status,
		&task.TargetDate, &task.TargetTimeSlot, &schemaBytes,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Task not found")
	}

	if task.Status == models.TaskStatusDone {
		return echo.NewHTTPError(http.StatusBadRequest, "This task is already completed and submitted")
	}

	if inspectorID == "" {
		inspectorID = task.AssignedUserID
	}

	// 2. Dynamic schema validation & lock target_time_slot into payload if set
	var schema models.FormSchema
	if err := json.Unmarshal(schemaBytes, &schema); err == nil {
		var answers map[string]any
		if err := json.Unmarshal(req.Payload, &answers); err == nil {
			// Lock designated slot from task if task has a target_time_slot
			if task.TargetTimeSlot != "" {
				answers["observation_time_slot"] = task.TargetTimeSlot
				if updatedPayload, err := json.Marshal(answers); err == nil {
					req.Payload = updatedPayload
				}
			}

			for _, field := range schema.Fields {
				val, exists := answers[field.Key]
				if field.Required && (!exists || val == nil || val == "") {
					// Check conditional visibility rule before flagging as missing
					if field.ShowIf != nil {
						condVal := answers[field.ShowIf.FieldKey]
						if condVal != field.ShowIf.Value {
							continue // skipped because condition not met
						}
					}
					return echo.NewHTTPError(http.StatusBadRequest, fmt.Sprintf("Field '%s' (%s) wajib diisi", field.Label, field.Key))
				}
			}
		}
	}

	// 3. Transaction to mark task DONE and insert record
	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer tx.Rollback(context.Background())

	now := time.Now()
	_, err = tx.Exec(context.Background(),
		`UPDATE inspection_tasks 
		 SET status = 'DONE', completed_at = $1, draft_data = '{}'::jsonb 
		 WHERE id = $2`,
		now, taskID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update task status: "+err.Error())
	}

	recordID := "rec-" + uuid.New().String()[:8]
	targetDate := task.TargetDate
	if targetDate == "" {
		targetDate = now.Format("2006-01-02")
	}
	_, err = tx.Exec(context.Background(),
		`INSERT INTO inspection_records 
		 (id, task_id, camera_id, inspector_id, template_version_id, payload, notes, target_date, target_time_slot, review_status, submitted_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10)`,
		recordID, taskID, task.CameraID, inspectorID, task.TemplateVersionID, req.Payload, req.Notes, targetDate, task.TargetTimeSlot, now,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to store inspection record: "+err.Error())
	}

	// Log audit trail
	auditID := "aud-" + uuid.New().String()[:8]
	_, _ = tx.Exec(context.Background(),
		`INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
		 VALUES ($1, $2, 'INSPECTION_SUBMIT', 'TASK', $3, $4)`,
		auditID, inspectorID, taskID, req.Payload,
	)

	if err := tx.Commit(context.Background()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to commit submission: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]any{
		"message":    "Inspection completed and submitted successfully",
		"record_id":  recordID,
		"task_id":    taskID,
		"status":     models.TaskStatusDone,
		"submitted_at": now,
	})
}

type ReassignTaskRequest struct {
	AssignedUserID string `json:"assigned_user_id"`
}

func (h *TaskHandler) ReassignTask(c echo.Context) error {
	id := c.Param("id")
	var req ReassignTaskRequest
	if err := c.Bind(&req); err != nil || req.AssignedUserID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "assigned_user_id is required")
	}

	_, err := db.Pool.Exec(context.Background(),
		"UPDATE inspection_tasks SET assigned_user_id = $1 WHERE id = $2",
		req.AssignedUserID, id,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to reassign task: "+err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Task reassigned successfully"})
}

func (h *TaskHandler) DeleteTask(c echo.Context) error {
	id := c.Param("id")
	_, err := db.Pool.Exec(context.Background(), "DELETE FROM inspection_tasks WHERE id = $1", id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete task: "+err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

