package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"camtrack-backend/models"

	"github.com/labstack/echo/v4"
)

func setupTestHeatmapHandler() (*HeatmapHandler, *echo.Echo) {
	e := echo.New()
	handler := NewHeatmapHandler("data")
	return handler, e
}

func TestHeatmapGetLayout(t *testing.T) {
	handler, e := setupTestHeatmapHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/map-heatmap/layout", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetLayout(c); err != nil {
		t.Fatalf("GetLayout returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var layout models.MapLayout
	if err := json.Unmarshal(rec.Body.Bytes(), &layout); err != nil {
		t.Fatalf("failed to decode layout JSON: %v", err)
	}

	if layout.TotalShelves != 949 {
		t.Errorf("expected 949 shelves, got %d", layout.TotalShelves)
	}

	if len(layout.Shelves) != 949 {
		t.Errorf("expected 949 shelves in array, got %d", len(layout.Shelves))
	}

	if layout.TotalZones != 75 {
		t.Errorf("expected 75 zones, got %d", layout.TotalZones)
	}
}

func TestHeatmapGetManifest(t *testing.T) {
	handler, e := setupTestHeatmapHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/map-heatmap/manifest", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetManifest(c); err != nil {
		t.Fatalf("GetManifest returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var manifest models.HeatmapManifest
	if err := json.Unmarshal(rec.Body.Bytes(), &manifest); err != nil {
		t.Fatalf("failed to decode manifest JSON: %v", err)
	}

	if manifest.TotalDays != 17 {
		t.Errorf("expected 17 days, got %d", manifest.TotalDays)
	}

	if len(manifest.AvailableDates) != 17 {
		t.Errorf("expected 17 available dates, got %d", len(manifest.AvailableDates))
	}
}

func TestHeatmapGetDailyDataValid(t *testing.T) {
	handler, e := setupTestHeatmapHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/map-heatmap/daily?date=2026-10-14", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetDailyData(c); err != nil {
		t.Fatalf("GetDailyData returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var daily models.DailyHeatmap
	if err := json.Unmarshal(rec.Body.Bytes(), &daily); err != nil {
		t.Fatalf("failed to decode daily JSON: %v", err)
	}

	if daily.Date != "2026-10-14" {
		t.Errorf("expected date 2026-10-14, got %s", daily.Date)
	}

	if daily.TotalEvents != 884936 {
		t.Errorf("expected 884936 total events, got %d", daily.TotalEvents)
	}

	if daily.MappedEvents != 646016 {
		t.Errorf("expected 646016 mapped events, got %d", daily.MappedEvents)
	}

	if daily.UnmappedEvents != 238920 {
		t.Errorf("expected 238920 unmapped events, got %d", daily.UnmappedEvents)
	}

	// Reconciliation check
	if daily.TotalEvents != daily.MappedEvents+daily.UnmappedEvents {
		t.Errorf("reconciliation failed: %d != %d + %d", daily.TotalEvents, daily.MappedEvents, daily.UnmappedEvents)
	}

	if daily.TopShelf == nil || daily.TopShelf.ID != "4FB" {
		t.Errorf("expected top shelf 4FB, got %+v", daily.TopShelf)
	}
}

func TestHeatmapGetDailyDataUnknown(t *testing.T) {
	handler, e := setupTestHeatmapHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/map-heatmap/daily?date=2026-12-31", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetDailyData(c); err != nil {
		t.Fatalf("GetDailyData returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var daily models.DailyHeatmap
	if err := json.Unmarshal(rec.Body.Bytes(), &daily); err != nil {
		t.Fatalf("failed to decode daily JSON: %v", err)
	}

	if daily.TotalEvents != 0 {
		t.Errorf("expected 0 total events for non-existent date, got %d", daily.TotalEvents)
	}
}

func TestHeatmapGetDailyDataInvalidParam(t *testing.T) {
	handler, e := setupTestHeatmapHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/map-heatmap/daily?date=invalid-date", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := handler.GetDailyData(c); err != nil {
		t.Fatalf("GetDailyData returned error: %v", err)
	}

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 Bad Request, got %d", rec.Code)
	}
}
