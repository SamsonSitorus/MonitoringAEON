package models

import (
	"encoding/json"
	"time"
)

type UserRole string

const (
	RoleAdmin      UserRole = "admin"
	RoleInspector  UserRole = "inspector"
	RoleSupervisor UserRole = "supervisor"
)

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         UserRole  `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type Camera struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	System    string    `json:"system"`     // "InaAI" or "AEON"
	NVR       string    `json:"nvr"`        // e.g. "NVR1.10.1.6.3", "NVR1.10.1.6.4", "NVR AEON.10.123.32.20"
	ChannelNo int       `json:"channel_no"` // e.g. 1, 2, 3
	Status    string    `json:"status"`     // online, offline, maintenance
	CreatedAt time.Time `json:"created_at"`
}

type ConditionalRule struct {
	FieldKey string `json:"field_key"`
	Operator string `json:"operator"` // equals, not_equals, greater_than, contains
	Value    any    `json:"value"`
}

type FormField struct {
	Key          string           `json:"key"`
	Label        string           `json:"label"`
	Type         string           `json:"type"` // number, text, dropdown, radio, checkbox, yes_no, date, photo, formula
	Required     bool             `json:"required"`
	Min          *float64         `json:"min,omitempty"`
	Max          *float64         `json:"max,omitempty"`
	Options      []string         `json:"options,omitempty"`
	Placeholder  string           `json:"placeholder,omitempty"`
	DefaultValue any              `json:"default_value,omitempty"`
	ShowIf       *ConditionalRule `json:"show_if,omitempty"`
	Formula      string           `json:"formula,omitempty"` // e.g. "{male_count} + {female_count}"
	HelpText     string           `json:"help_text,omitempty"`
}

type FormSchema struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Fields      []FormField `json:"fields"`
}

type FormTemplate struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Code          string      `json:"code"`
	Description   string      `json:"description"`
	IsActive      bool        `json:"is_active"`
	LatestVersion int         `json:"latest_version,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	Versions      []FormTemplateVersion `json:"versions,omitempty"`
}

type FormTemplateVersion struct {
	ID            string     `json:"id"`
	TemplateID    string     `json:"template_id"`
	VersionNumber int        `json:"version_number"`
	SchemaJSON    FormSchema `json:"schema"`
	CreatedBy     string     `json:"created_by,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

type TaskStatus string

const (
	TaskStatusNotStarted     TaskStatus = "NOT_STARTED"
	TaskStatusInProgress     TaskStatus = "IN_PROGRESS"
	TaskStatusDone           TaskStatus = "DONE"
	TaskStatusRevisionNeeded TaskStatus = "REVISION_NEEDED"
)

type InspectionTask struct {
	ID                string          `json:"id"`
	CameraID          string          `json:"camera_id"`
	AssignedUserID    string          `json:"assigned_user_id"`
	TemplateVersionID string          `json:"template_version_id"`
	Status            TaskStatus      `json:"status"`
	DraftData         json.RawMessage `json:"draft_data,omitempty"`
	TargetDate        string          `json:"target_date,omitempty"`
	TargetTimeSlot    string          `json:"target_time_slot,omitempty"`
	DueDate           *time.Time      `json:"due_date,omitempty"`
	CompletedAt       *time.Time      `json:"completed_at,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`

	// Enriched fields for easy UI rendering
	CameraName       string      `json:"camera_name,omitempty"`
	CameraCode       string      `json:"camera_code,omitempty"`
	CameraSystem     string      `json:"camera_system,omitempty"`
	CameraNVR        string      `json:"camera_nvr,omitempty"`
	CameraChannelNo  int         `json:"camera_channel_no,omitempty"`
	AssignedUserName string      `json:"assigned_user_name,omitempty"`
	TemplateName     string      `json:"template_name,omitempty"`
	VersionNumber    int         `json:"version_number,omitempty"`
	Schema           *FormSchema `json:"schema,omitempty"`
}

type InspectionRecord struct {
	ID                string          `json:"id"`
	TaskID            string          `json:"task_id"`
	CameraID          string          `json:"camera_id"`
	InspectorID       string          `json:"inspector_id"`
	TemplateVersionID string          `json:"template_version_id"`
	Payload           json.RawMessage `json:"payload"`
	Notes             string          `json:"notes,omitempty"`
	TargetDate        string          `json:"target_date,omitempty"`
	TargetTimeSlot    string          `json:"target_time_slot,omitempty"`
	ReviewStatus      string          `json:"review_status"` // PENDING, APPROVED, REVISION_REQUESTED
	ReviewNotes       string          `json:"review_notes,omitempty"`
	ReviewerID        *string         `json:"reviewer_id,omitempty"`
	SubmittedAt       time.Time       `json:"submitted_at"`
	ReviewedAt        *time.Time      `json:"reviewed_at,omitempty"`

	// Enriched fields
	CameraName      string `json:"camera_name,omitempty"`
	CameraCode      string `json:"camera_code,omitempty"`
	CameraSystem    string `json:"camera_system,omitempty"`
	CameraNVR       string `json:"camera_nvr,omitempty"`
	CameraChannelNo int    `json:"camera_channel_no,omitempty"`
	InspectorName   string `json:"inspector_name,omitempty"`
	TemplateName    string `json:"template_name,omitempty"`
	VersionNumber   int    `json:"version_number,omitempty"`
	ReviewerName    string `json:"reviewer_name,omitempty"`
}

type UserProgressStat struct {
	UserID          string  `json:"user_id"`
	UserName        string  `json:"user_name"`
	UserEmail       string  `json:"user_email"`
	Role            string  `json:"role"`
	TotalAssigned   int     `json:"total_assigned"`
	DoneCount       int     `json:"done_count"`
	InProgressCount int     `json:"in_progress_count"`
	NotStartedCount int     `json:"not_started_count"`
	RevisionCount   int     `json:"revision_count"`
	ProgressPct     float64 `json:"progress_pct"`
}

type DashboardStats struct {
	TotalTasks          int                `json:"total_tasks"`
	DoneTasks           int                `json:"done_tasks"`
	InProgressTasks     int                `json:"in_progress_tasks"`
	NotStartedTasks     int                `json:"not_started_tasks"`
	RevisionTasks       int                `json:"revision_tasks"`
	OverallProgressPct  float64            `json:"overall_progress_pct"`
	UserProgressStats   []UserProgressStat `json:"user_progress_stats"`
	CameraStatusSummary map[string]int     `json:"camera_status_summary"`
}

type ResultsSummary struct {
	TotalInspections   int            `json:"total_inspections"`
	TotalPeopleCounted int            `json:"total_people_counted"`
	TotalMalesCounted  int            `json:"total_males_counted"`
	TotalFemalesCounted int           `json:"total_females_counted"`
	TotalIssuesFound   int            `json:"total_issues_found"`
	CategoryBreakdown  map[string]int `json:"category_breakdown"`
}
