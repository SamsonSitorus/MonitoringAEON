package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"camtrack-backend/db"
	"camtrack-backend/middleware"
	"camtrack-backend/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type FormHandler struct{}

func NewFormHandler() *FormHandler {
	return &FormHandler{}
}

func (h *FormHandler) ListTemplates(c echo.Context) error {
	query := `
		SELECT 
			ft.id, ft.name, ft.code, ft.description, ft.is_active, ft.created_at,
			COALESCE(MAX(ftv.version_number), 1) as latest_version
		FROM form_templates ft
		LEFT JOIN form_template_versions ftv ON ft.id = ftv.template_id
		GROUP BY ft.id, ft.name, ft.code, ft.description, ft.is_active, ft.created_at
		ORDER BY ft.created_at DESC
	`

	rows, err := db.Pool.Query(context.Background(), query)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	templates := make([]models.FormTemplate, 0)
	for rows.Next() {
		var tmpl models.FormTemplate
		if err := rows.Scan(
			&tmpl.ID, &tmpl.Name, &tmpl.Code, &tmpl.Description, &tmpl.IsActive, &tmpl.CreatedAt, &tmpl.LatestVersion,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		templates = append(templates, tmpl)
	}

	return c.JSON(http.StatusOK, templates)
}

func (h *FormHandler) GetTemplate(c echo.Context) error {
	id := c.Param("id")

	var tmpl models.FormTemplate
	query := `SELECT id, name, code, description, is_active, created_at FROM form_templates WHERE id = $1`
	err := db.Pool.QueryRow(context.Background(), query, id).Scan(
		&tmpl.ID, &tmpl.Name, &tmpl.Code, &tmpl.Description, &tmpl.IsActive, &tmpl.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Template not found")
	}

	// Fetch all versions
	vQuery := `
		SELECT id, template_id, version_number, schema_json, created_by, created_at
		FROM form_template_versions
		WHERE template_id = $1
		ORDER BY version_number DESC
	`
	rows, err := db.Pool.Query(context.Background(), vQuery, id)
	if err == nil {
		defer rows.Close()
		versions := make([]models.FormTemplateVersion, 0)
		for rows.Next() {
			var v models.FormTemplateVersion
			var schemaBytes []byte
			if err := rows.Scan(&v.ID, &v.TemplateID, &v.VersionNumber, &schemaBytes, &v.CreatedBy, &v.CreatedAt); err == nil {
				_ = json.Unmarshal(schemaBytes, &v.SchemaJSON)
				versions = append(versions, v)
			}
		}
		tmpl.Versions = versions
		if len(versions) > 0 {
			tmpl.LatestVersion = versions[0].VersionNumber
		}
	}

	return c.JSON(http.StatusOK, tmpl)
}

type CreateTemplateRequest struct {
	Name        string            `json:"name"`
	Code        string            `json:"code"`
	Description string            `json:"description"`
	Schema      models.FormSchema `json:"schema"`
}

func (h *FormHandler) CreateTemplate(c echo.Context) error {
	var req CreateTemplateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.Name == "" || req.Code == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Name and Code are required")
	}

	claims := middleware.GetUserFromContext(c)
	creatorID := ""
	if claims != nil {
		creatorID = claims.UserID
	}

	templateID := "tmpl-" + uuid.New().String()[:8]
	versionID := "ver-" + uuid.New().String()[:8]

	schemaBytes, err := json.Marshal(req.Schema)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid schema JSON")
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to start transaction")
	}
	defer tx.Rollback(context.Background())

	_, err = tx.Exec(context.Background(),
		`INSERT INTO form_templates (id, name, code, description, is_active)
		 VALUES ($1, $2, $3, $4, true)`,
		templateID, req.Name, req.Code, req.Description,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create template: "+err.Error())
	}

	_, err = tx.Exec(context.Background(),
		`INSERT INTO form_template_versions (id, template_id, version_number, schema_json, created_by)
		 VALUES ($1, $2, $3, $4, $5)`,
		versionID, templateID, 1, schemaBytes, creatorID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create version 1: "+err.Error())
	}

	if err := tx.Commit(context.Background()); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to commit")
	}

	return c.JSON(http.StatusCreated, map[string]any{
		"template_id": templateID,
		"version_id":  versionID,
		"version":     1,
		"message":     "Form template and initial version created successfully",
	})
}

type CreateVersionRequest struct {
	Schema models.FormSchema `json:"schema"`
}

func (h *FormHandler) CreateVersion(c echo.Context) error {
	templateID := c.Param("id")

	var req CreateVersionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	claims := middleware.GetUserFromContext(c)
	creatorID := ""
	if claims != nil {
		creatorID = claims.UserID
	}

	// Find current max version
	var maxVer int
	err := db.Pool.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(version_number), 0) FROM form_template_versions WHERE template_id = $1",
		templateID,
	).Scan(&maxVer)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	newVersion := maxVer + 1
	versionID := fmt.Sprintf("ver-%s-v%d", templateID[len(templateID)-4:], newVersion)

	schemaBytes, err := json.Marshal(req.Schema)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid schema")
	}

	_, err = db.Pool.Exec(context.Background(),
		`INSERT INTO form_template_versions (id, template_id, version_number, schema_json, created_by)
		 VALUES ($1, $2, $3, $4, $5)`,
		versionID, templateID, newVersion, schemaBytes, creatorID,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create new version: "+err.Error())
	}

	return c.JSON(http.StatusCreated, map[string]any{
		"id":             versionID,
		"template_id":    templateID,
		"version_number": newVersion,
		"schema":         req.Schema,
	})
}

func (h *FormHandler) GetVersion(c echo.Context) error {
	versionID := c.Param("versionId")

	var v models.FormTemplateVersion
	var schemaBytes []byte
	err := db.Pool.QueryRow(context.Background(),
		"SELECT id, template_id, version_number, schema_json, created_by, created_at FROM form_template_versions WHERE id = $1",
		versionID,
	).Scan(&v.ID, &v.TemplateID, &v.VersionNumber, &schemaBytes, &v.CreatedBy, &v.CreatedAt)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Template version not found")
	}

	_ = json.Unmarshal(schemaBytes, &v.SchemaJSON)
	return c.JSON(http.StatusOK, v)
}
