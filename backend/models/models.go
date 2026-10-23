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
	UserID          string   `json:"user_id"`
	UserName        string   `json:"user_name"`
	UserEmail       string   `json:"user_email"`
	Role            string   `json:"role"`
	TotalAssigned   int      `json:"total_assigned"`
	DoneCount       int      `json:"done_count"`
	InProgressCount int      `json:"in_progress_count"`
	NotStartedCount int      `json:"not_started_count"`
	RevisionCount   int      `json:"revision_count"`
	ProgressPct     float64  `json:"progress_pct"`
	AssignedCameras []string `json:"assigned_cameras,omitempty"`
	DoneCameras     []string `json:"done_cameras,omitempty"`
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
	TotalInspections    int            `json:"total_inspections"`
	TotalPeopleCounted  int            `json:"total_people_counted"`
	TotalMalesCounted   int            `json:"total_males_counted"`
	TotalFemalesCounted int            `json:"total_females_counted"`
	TotalIssuesFound    int            `json:"total_issues_found"`
	CategoryBreakdown   map[string]int `json:"category_breakdown"`
	ActionsBreakdown    map[string]int `json:"actions_breakdown,omitempty"`
	AgeBreakdown        map[string]int `json:"age_breakdown,omitempty"`
}

// Map Heatmap Models
type ShelfMetadata struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Isle        string    `json:"isle"`
	Area        string    `json:"area"`
	CADCentroid []float64 `json:"cad_centroid"`
	SVGCentroid []float64 `json:"svg_centroid"`
	SVGPoints   string    `json:"svg_points"`
	BoundsSVG   []float64 `json:"bounds_svg"`
}

type MajorLabel struct {
	Text   string    `json:"text"`
	PosSVG []float64 `json:"pos_svg"`
	Area   string    `json:"area"`
	Type   string    `json:"type"`
	Size   float64   `json:"size"`
}

type StoreAreaInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	ShelfCount  int    `json:"shelf_count"`
	ZoneCount   int    `json:"zone_count"`
	CameraCount int    `json:"camera_count,omitempty"`
	Color       string `json:"color"`
}

type ZoneMetadata struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Area        float64   `json:"area"`
	ParentArea  string    `json:"parent_area,omitempty"`
	AreaID      string    `json:"area_id,omitempty"`
	IsDelica    bool      `json:"is_delica,omitempty"`
	IsEntrance  bool      `json:"is_entrance,omitempty"`
	SVGPoints   string    `json:"svg_points"`
	CentroidSVG []float64 `json:"centroid_svg"`
	CadCentroid []float64 `json:"cad_centroid,omitempty"`
}

type CameraMapItem struct {
	ID              string    `json:"id"`
	Label           string    `json:"label"`
	RawPos          []float64 `json:"raw_pos"`
	SVGPos          []float64 `json:"svg_pos"`
	CadPos          []float64 `json:"cad_pos"`
	HeadingDeg      float64   `json:"heading_deg"`
	FOVDeg          float64   `json:"fov_deg"`
	RangeM          float64   `json:"range_m"`
	RangeSVG        float64   `json:"range_svg"`
	ReviewStatus    string    `json:"review_status"`
	IsPlanned       bool      `json:"is_planned"`
	Area            string    `json:"area"`
	AreaID          string    `json:"area_id"`
	NearestZone     string    `json:"nearest_zone,omitempty"`
	NearestShelf    string    `json:"nearest_shelf,omitempty"`
	Note            string    `json:"note,omitempty"`
	VideoCount      int       `json:"video_count"`
	HasHomography   bool      `json:"has_homography"`
	HomographyPairs int       `json:"homography_pairs"`
	FOVPath         string    `json:"fov_path"`
}

type CameraMapSummary struct {
	Total    int            `json:"total"`
	Verified int            `json:"verified"`
	Planned  int            `json:"planned"`
	ByArea   map[string]int `json:"by_area"`
}

type MapLayout struct {
	ViewboxFull    string            `json:"viewbox_full"`
	ViewboxFocused string            `json:"viewbox_focused"`
	ViewboxDelica  string            `json:"viewbox_delica,omitempty"`
	StoreBoundary  string            `json:"store_boundary,omitempty"`
	Areas          []StoreAreaInfo   `json:"areas,omitempty"`
	MajorLabels    []MajorLabel      `json:"major_labels,omitempty"`
	TotalShelves   int               `json:"total_shelves"`
	TotalZones     int               `json:"total_zones"`
	TotalCameras   int               `json:"total_cameras,omitempty"`
	CamerasSummary *CameraMapSummary `json:"cameras_summary,omitempty"`
	Shelves        []ShelfMetadata   `json:"shelves"`
	Zones          []ZoneMetadata    `json:"zones"`
	Cameras        []CameraMapItem   `json:"cameras,omitempty"`
}

type TopShelfInfo struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Isle       string  `json:"isle"`
	Area       string  `json:"area"`
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type AreaStat struct {
	TotalEvents       int    `json:"total_events"`
	ShelvesWithEvents int    `json:"shelves_with_events"`
	TotalShelves      int    `json:"total_shelves"`
	Description       string `json:"description,omitempty"`
	Status            string `json:"status,omitempty"`
}

type IsleStat struct {
	TotalEvents        int    `json:"total_events"`
	ShelvesWithEvents  int    `json:"shelves_with_events"`
	TotalShelves       int    `json:"total_shelves"`
	Area               string `json:"area"`
}

type ShelfActionBreakdown struct {
	Actions   map[string]int `json:"actions"`
	AIActions map[string]int `json:"ai_actions,omitempty"`
}

type DailyHeatmap struct {
	Date              string                          `json:"date"`
	TotalEvents       int                             `json:"total_events"`
	MappedEvents      int                             `json:"mapped_events"`
	UnmappedEvents    int                             `json:"unmapped_events"`
	MappedPercentage  float64                         `json:"mapped_percentage"`
	ShelvesTotal      int                             `json:"shelves_total"`
	ShelvesWithEvents int                             `json:"shelves_with_events"`
	IslesCount        int                             `json:"isles_count"`
	AreasCount        int                             `json:"areas_count"`
	TopShelf          *TopShelfInfo                   `json:"top_shelf"`
	ActionBreakdown   map[string]int                  `json:"action_breakdown"`
	ShelfCounts       map[string]int                  `json:"shelf_counts"`
	ShelfActions      map[string]ShelfActionBreakdown `json:"shelf_actions,omitempty"`
	AreaSummary       map[string]AreaStat             `json:"area_summary"`
	IsleSummary       map[string]IsleStat             `json:"isle_summary"`
	ProcessedAt       string                          `json:"processed_at,omitempty"`
	DurationSeconds   float64                         `json:"duration_seconds,omitempty"`
}

type HeatmapDateSummary struct {
	Date              string `json:"date"`
	TotalEvents       int    `json:"total_events"`
	MappedEvents      int    `json:"mapped_events"`
	UnmappedEvents    int    `json:"unmapped_events"`
	TopShelfName      string `json:"top_shelf_name"`
	TopShelfCount     int    `json:"top_shelf_count"`
	ShelvesWithEvents int    `json:"shelves_with_events"`
}

type HeatmapManifest struct {
	AvailableDates []string             `json:"available_dates"`
	TotalDays      int                  `json:"total_days"`
	DatesSummary   []HeatmapDateSummary `json:"dates_summary"`
	LastUpdated    string               `json:"last_updated"`
}

type AuditLog struct {
	ID         string          `json:"id"`
	UserID     string          `json:"user_id"`
	UserName   string          `json:"user_name,omitempty"`
	UserEmail  string          `json:"user_email,omitempty"`
	UserRole   string          `json:"user_role,omitempty"`
	Action     string          `json:"action"`
	TargetType string          `json:"target_type"`
	TargetID   string          `json:"target_id,omitempty"`
	Details    json.RawMessage `json:"details,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

type AuditStats struct {
	TotalLogs        int            `json:"total_logs"`
	TodayLogs        int            `json:"today_logs"`
	ActionBreakdown  map[string]int `json:"action_breakdown"`
	CategoryBreakdown map[string]int `json:"category_breakdown"`
}
