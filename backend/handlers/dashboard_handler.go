package handlers

import (
	"context"
	"encoding/json"
	"math"
	"net/http"

	"camtrack-backend/db"
	"camtrack-backend/models"

	"github.com/labstack/echo/v4"
)

type DashboardHandler struct{}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{}
}

func (h *DashboardHandler) GetStats(c echo.Context) error {
	ctx := context.Background()
	dateParam := c.QueryParam("date") // format: YYYY-MM-DD or empty for all

	// 1. Task counts (filtered by target_date if provided)
	taskCountsQuery := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'DONE') as done,
			COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
			COUNT(*) FILTER (WHERE status = 'NOT_STARTED') as not_started,
			COUNT(*) FILTER (WHERE status = 'REVISION_NEEDED') as revision
		FROM inspection_tasks
		WHERE ($1 = '' OR target_date::text = $1)
	`
	var stats models.DashboardStats
	err := db.Pool.QueryRow(ctx, taskCountsQuery, dateParam).Scan(
		&stats.TotalTasks, &stats.DoneTasks, &stats.InProgressTasks, &stats.NotStartedTasks, &stats.RevisionTasks,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	if stats.TotalTasks > 0 {
		stats.OverallProgressPct = math.Round((float64(stats.DoneTasks)/float64(stats.TotalTasks))*1000) / 10
	}

	// 2. Per-user progress (scoped to target_date if provided)
	// Order by:
	// 1. Users with active assignments first
	// 2. Users with lowest progress first (attention first)
	// 3. User name alphabetically
	userProgressQuery := `
		SELECT 
			u.id, u.name, u.email, u.role,
			COUNT(t.id) as total_assigned,
			COUNT(t.id) FILTER (WHERE t.status = 'DONE') as done_count,
			COUNT(t.id) FILTER (WHERE t.status = 'IN_PROGRESS') as in_progress_count,
			COUNT(t.id) FILTER (WHERE t.status = 'NOT_STARTED') as not_started_count,
			COUNT(t.id) FILTER (WHERE t.status = 'REVISION_NEEDED') as revision_count
		FROM users u
		LEFT JOIN inspection_tasks t ON u.id = t.assigned_user_id AND ($1 = '' OR t.target_date::text = $1)
		WHERE u.role = 'inspector'
		GROUP BY u.id, u.name, u.email, u.role
		ORDER BY 
			CASE WHEN COUNT(t.id) > 0 THEN 0 ELSE 1 END,
			(COUNT(t.id) FILTER (WHERE t.status = 'DONE')::float / NULLIF(COUNT(t.id), 0)) ASC NULLS LAST,
			u.name ASC
	`
	rows, err := db.Pool.Query(ctx, userProgressQuery, dateParam)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	userStats := make([]models.UserProgressStat, 0)
	for rows.Next() {
		var u models.UserProgressStat
		if err := rows.Scan(
			&u.UserID, &u.UserName, &u.UserEmail, &u.Role,
			&u.TotalAssigned, &u.DoneCount, &u.InProgressCount, &u.NotStartedCount, &u.RevisionCount,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		if u.TotalAssigned > 0 {
			u.ProgressPct = math.Round((float64(u.DoneCount)/float64(u.TotalAssigned))*1000) / 10
		}
		userStats = append(userStats, u)
	}
	stats.UserProgressStats = userStats

	// 3. Camera status counts
	camStatusQuery := `
		SELECT status, COUNT(*) 
		FROM cameras 
		GROUP BY status
	`
	cRows, err := db.Pool.Query(ctx, camStatusQuery)
	if err == nil {
		defer cRows.Close()
		camStatusMap := make(map[string]int)
		for cRows.Next() {
			var st string
			var count int
			if err := cRows.Scan(&st, &count); err == nil {
				camStatusMap[st] = count
			}
		}
		stats.CameraStatusSummary = camStatusMap
	}

	return c.JSON(http.StatusOK, stats)
}

func (h *DashboardHandler) GetResultsSummary(c echo.Context) error {
	ctx := context.Background()

	query := `SELECT payload FROM inspection_records`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	summary := models.ResultsSummary{
		CategoryBreakdown: make(map[string]int),
	}

	for rows.Next() {
		var payloadBytes []byte
		if err := rows.Scan(&payloadBytes); err != nil {
			continue
		}
		summary.TotalInspections++

		var data map[string]any
		if err := json.Unmarshal(payloadBytes, &data); err != nil {
			continue
		}

		if m, ok := data["male_count"].(float64); ok {
			summary.TotalMalesCounted += int(m)
		}
		if f, ok := data["female_count"].(float64); ok {
			summary.TotalFemalesCounted += int(f)
		}
		if tot, ok := data["total_people"].(float64); ok {
			summary.TotalPeopleCounted += int(tot)
		}

		if issue, ok := data["has_issue"].(bool); ok && issue {
			summary.TotalIssuesFound++
		}
		if act, ok := data["activity_occurred"].(bool); ok && act {
			summary.TotalIssuesFound++
		}

		if density, ok := data["density_level"].(string); ok && density != "" {
			summary.CategoryBreakdown[density]++
		}
		if area, ok := data["area_status"].(string); ok && area != "" {
			summary.CategoryBreakdown[area]++
		}
	}

	// Fallback calculate total people if not directly set
	if summary.TotalPeopleCounted == 0 && (summary.TotalMalesCounted > 0 || summary.TotalFemalesCounted > 0) {
		summary.TotalPeopleCounted = summary.TotalMalesCounted + summary.TotalFemalesCounted
	}

	return c.JSON(http.StatusOK, summary)
}
