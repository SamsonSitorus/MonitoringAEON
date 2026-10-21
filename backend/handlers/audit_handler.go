package handlers

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"camtrack-backend/db"
	"camtrack-backend/models"

	"github.com/labstack/echo/v4"
)

type AuditHandler struct{}

func NewAuditHandler() *AuditHandler {
	return &AuditHandler{}
}

func (h *AuditHandler) ListAuditLogs(c echo.Context) error {
	action := c.QueryParam("action")
	targetType := c.QueryParam("target_type")
	userID := c.QueryParam("user_id")
	search := c.QueryParam("search")
	startDate := c.QueryParam("start_date")
	endDate := c.QueryParam("end_date")

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.QueryParam("page_size"))
	if pageSize < 1 || pageSize > 500 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	baseQuery := `
		FROM audit_logs a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE 1=1
	`
	args := make([]any, 0)
	argIdx := 1

	if action != "" && action != "ALL" {
		baseQuery += fmt.Sprintf(" AND a.action = $%d", argIdx)
		args = append(args, action)
		argIdx++
	}
	if targetType != "" && targetType != "ALL" {
		baseQuery += fmt.Sprintf(" AND a.target_type = $%d", argIdx)
		args = append(args, targetType)
		argIdx++
	}
	if userID != "" && userID != "ALL" {
		baseQuery += fmt.Sprintf(" AND a.user_id = $%d", argIdx)
		args = append(args, userID)
		argIdx++
	}
	if startDate != "" {
		baseQuery += fmt.Sprintf(" AND a.created_at >= $%d::timestamp", argIdx)
		args = append(args, startDate+" 00:00:00")
		argIdx++
	}
	if endDate != "" {
		baseQuery += fmt.Sprintf(" AND a.created_at <= $%d::timestamp", argIdx)
		args = append(args, endDate+" 23:59:59")
		argIdx++
	}
	if search != "" {
		baseQuery += fmt.Sprintf(" AND (a.id ILIKE $%d OR a.action ILIKE $%d OR a.target_type ILIKE $%d OR a.target_id ILIKE $%d OR COALESCE(u.name, '') ILIKE $%d OR COALESCE(u.email, '') ILIKE $%d OR a.details::text ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Count total
	countQuery := "SELECT COUNT(*) " + baseQuery
	var total int
	err := db.Pool.QueryRow(context.Background(), countQuery, args...).Scan(&total)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to count audit logs: "+err.Error())
	}

	// Fetch data
	dataQuery := `
		SELECT 
			a.id, 
			COALESCE(a.user_id, ''), 
			COALESCE(u.name, 'Sistem / Anonim'), 
			COALESCE(u.email, ''), 
			COALESCE(u.role, ''), 
			a.action, 
			a.target_type, 
			COALESCE(a.target_id, ''), 
			a.details, 
			a.created_at
	` + baseQuery + fmt.Sprintf(" ORDER BY a.created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := db.Pool.Query(context.Background(), dataQuery, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch audit logs: "+err.Error())
	}
	defer rows.Close()

	logs := make([]models.AuditLog, 0)
	for rows.Next() {
		var l models.AuditLog
		var detailsBytes []byte
		if err := rows.Scan(
			&l.ID, &l.UserID, &l.UserName, &l.UserEmail, &l.UserRole,
			&l.Action, &l.TargetType, &l.TargetID, &detailsBytes, &l.CreatedAt,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Failed to scan audit log: "+err.Error())
		}
		l.Details = detailsBytes
		logs = append(logs, l)
	}

	totalPages := (total + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}

	return c.JSON(http.StatusOK, map[string]any{
		"data":        logs,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

func (h *AuditHandler) GetAuditStats(c echo.Context) error {
	ctx := context.Background()

	var totalLogs int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM audit_logs").Scan(&totalLogs)

	var todayLogs int
	_ = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM audit_logs WHERE created_at >= CURRENT_DATE").Scan(&todayLogs)

	// Action breakdown
	actionRows, err := db.Pool.Query(ctx, "SELECT action, COUNT(*) FROM audit_logs GROUP BY action ORDER BY count DESC")
	actionBreakdown := make(map[string]int)
	if err == nil {
		defer actionRows.Close()
		for actionRows.Next() {
			var act string
			var count int
			if err := actionRows.Scan(&act, &count); err == nil {
				actionBreakdown[act] = count
			}
		}
	}

	// Category breakdown
	catRows, err := db.Pool.Query(ctx, "SELECT target_type, COUNT(*) FROM audit_logs GROUP BY target_type ORDER BY count DESC")
	categoryBreakdown := make(map[string]int)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var cat string
			var count int
			if err := catRows.Scan(&cat, &count); err == nil {
				categoryBreakdown[cat] = count
			}
		}
	}

	return c.JSON(http.StatusOK, models.AuditStats{
		TotalLogs:         totalLogs,
		TodayLogs:         todayLogs,
		ActionBreakdown:   actionBreakdown,
		CategoryBreakdown: categoryBreakdown,
	})
}

func (h *AuditHandler) ExportAuditLogs(c echo.Context) error {
	action := c.QueryParam("action")
	targetType := c.QueryParam("target_type")
	search := c.QueryParam("search")

	query := `
		SELECT 
			a.id, 
			a.created_at,
			COALESCE(u.name, 'Sistem / Anonim'), 
			COALESCE(u.email, ''), 
			COALESCE(u.role, ''), 
			a.action, 
			a.target_type, 
			COALESCE(a.target_id, ''), 
			a.details::text
		FROM audit_logs a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE 1=1
	`
	args := make([]any, 0)
	argIdx := 1
	if action != "" && action != "ALL" {
		query += fmt.Sprintf(" AND a.action = $%d", argIdx)
		args = append(args, action)
		argIdx++
	}
	if targetType != "" && targetType != "ALL" {
		query += fmt.Sprintf(" AND a.target_type = $%d", argIdx)
		args = append(args, targetType)
		argIdx++
	}
	if search != "" {
		query += fmt.Sprintf(" AND (a.id ILIKE $%d OR a.action ILIKE $%d OR COALESCE(u.name, '') ILIKE $%d OR a.details::text ILIKE $%d)", argIdx, argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	query += " ORDER BY a.created_at DESC LIMIT 5000"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Write([]string{"ID Audit", "Waktu (WIB)", "Nama Pengguna", "Email", "Role", "Aksi", "Kategori", "Target ID", "Detail Aktivitas"})

	for rows.Next() {
		var id, userName, email, role, act, cat, targetID, details string
		var createdAt time.Time
		if err := rows.Scan(&id, &createdAt, &userName, &email, &role, &act, &cat, &targetID, &details); err == nil {
			writer.Write([]string{
				id,
				createdAt.Format("2006-01-02 15:04:05"),
				userName,
				email,
				role,
				act,
				cat,
				targetID,
				details,
			})
		}
	}
	writer.Flush()

	c.Response().Header().Set(echo.HeaderContentDisposition, fmt.Sprintf("attachment; filename=Audit_Trail_%s.csv", time.Now().Format("20060102_150405")))
	c.Response().Header().Set(echo.HeaderContentType, "text/csv; charset=utf-8")
	return c.Blob(http.StatusOK, "text/csv", buf.Bytes())
}
