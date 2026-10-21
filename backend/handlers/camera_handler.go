package handlers

import (
	"context"
	"fmt"
	"net/http"

	"camtrack-backend/db"
	"camtrack-backend/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

type CameraHandler struct{}

func NewCameraHandler() *CameraHandler {
	return &CameraHandler{}
}

func (h *CameraHandler) ListCameras(c echo.Context) error {
	status := c.QueryParam("status")
	search := c.QueryParam("search")
	system := c.QueryParam("system")
	nvr := c.QueryParam("nvr")

	query := `
		SELECT id, name, code, COALESCE(system, 'InaAI'), COALESCE(nvr, ''), COALESCE(channel_no, 1), status, created_at
		FROM cameras
		WHERE 1=1
	`
	args := make([]any, 0)
	argIdx := 1

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if system != "" {
		query += fmt.Sprintf(" AND system = $%d", argIdx)
		args = append(args, system)
		argIdx++
	}
	if nvr != "" {
		query += fmt.Sprintf(" AND nvr = $%d", argIdx)
		args = append(args, nvr)
		argIdx++
	}
	if search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR code ILIKE $%d OR nvr ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	query += ` ORDER BY system ASC, nvr ASC, channel_no ASC, code ASC`

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	cameras := make([]models.Camera, 0)
	for rows.Next() {
		var cam models.Camera
		if err := rows.Scan(
			&cam.ID, &cam.Name, &cam.Code, &cam.System, &cam.NVR, &cam.ChannelNo,
			&cam.Status, &cam.CreatedAt,
		); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		cameras = append(cameras, cam)
	}

	return c.JSON(http.StatusOK, cameras)
}

func (h *CameraHandler) GetCamera(c echo.Context) error {
	id := c.Param("id")

	var cam models.Camera
	query := `
		SELECT id, name, code, COALESCE(system, 'InaAI'), COALESCE(nvr, ''), COALESCE(channel_no, 1), status, created_at 
		FROM cameras 
		WHERE id = $1
	`
	err := db.Pool.QueryRow(context.Background(), query, id).Scan(
		&cam.ID, &cam.Name, &cam.Code, &cam.System, &cam.NVR, &cam.ChannelNo,
		&cam.Status, &cam.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Camera not found")
	}

	return c.JSON(http.StatusOK, cam)
}

type CreateCameraRequest struct {
	Name      string `json:"name"`
	Code      string `json:"code"`
	System    string `json:"system"`     // InaAI, AEON
	NVR       string `json:"nvr"`        // e.g. NVR1.10.1.6.3, NVR AEON.10.123.32.20
	ChannelNo int    `json:"channel_no"` // 1, 2, 3...
	Status    string `json:"status"`
}

func (h *CameraHandler) CreateCamera(c echo.Context) error {
	var req CreateCameraRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.Name == "" || req.Code == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Name and Code are required")
	}

	if req.System == "" {
		req.System = "InaAI"
	}
	if req.ChannelNo <= 0 {
		req.ChannelNo = 1
	}
	if req.Status == "" {
		req.Status = "online"
	}

	id := "cam-" + uuid.New().String()[:8]

	query := `
		INSERT INTO cameras (id, name, code, system, nvr, channel_no, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name, code, system, nvr, channel_no, status, created_at
	`
	var cam models.Camera
	err := db.Pool.QueryRow(context.Background(), query,
		id, req.Name, req.Code, req.System, req.NVR, req.ChannelNo, req.Status,
	).Scan(
		&cam.ID, &cam.Name, &cam.Code, &cam.System, &cam.NVR, &cam.ChannelNo,
		&cam.Status, &cam.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to create camera: "+err.Error())
	}

	return c.JSON(http.StatusCreated, cam)
}

func (h *CameraHandler) UpdateCamera(c echo.Context) error {
	id := c.Param("id")
	var req CreateCameraRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	query := `
		UPDATE cameras
		SET name = COALESCE(NULLIF($1, ''), name),
		    code = COALESCE(NULLIF($2, ''), code),
		    system = COALESCE(NULLIF($3, ''), system),
		    nvr = COALESCE(NULLIF($4, ''), nvr),
		    channel_no = CASE WHEN $5::int > 0 THEN $5::int ELSE channel_no END,
		    status = COALESCE(NULLIF($6, ''), status)
		WHERE id = $7
		RETURNING id, name, code, system, nvr, channel_no, status, created_at
	`
	var cam models.Camera
	err := db.Pool.QueryRow(context.Background(), query,
		req.Name, req.Code, req.System, req.NVR, req.ChannelNo, req.Status, id,
	).Scan(
		&cam.ID, &cam.Name, &cam.Code, &cam.System, &cam.NVR, &cam.ChannelNo,
		&cam.Status, &cam.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to update camera: "+err.Error())
	}

	return c.JSON(http.StatusOK, cam)
}

func (h *CameraHandler) DeleteCamera(c echo.Context) error {
	id := c.Param("id")
	_, err := db.Pool.Exec(context.Background(), "DELETE FROM cameras WHERE id = $1", id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete camera: "+err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
