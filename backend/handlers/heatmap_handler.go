package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"

	"camtrack-backend/models"

	"github.com/labstack/echo/v4"
)

type HeatmapHandler struct {
	dataDir string
}

func resolveDataDir(preferred string) string {
	candidates := []string{
		preferred,
		filepath.Join("backend", "data"),
		"data",
		filepath.Join("..", "data"),
		filepath.Join("..", "backend", "data"),
		filepath.Join("..", "..", "backend", "data"),
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(c, "map_layout.json")); err == nil {
			return c
		}
	}
	return preferred
}

func NewHeatmapHandler(dataDir string) *HeatmapHandler {
	return &HeatmapHandler{
		dataDir: resolveDataDir(dataDir),
	}
}

// GetLayout returns the store vector map layout (shelves, zones, viewboxes)
func (h *HeatmapHandler) GetLayout(c echo.Context) error {
	layoutPath := filepath.Join(h.dataDir, "map_layout.json")
	fileBytes, err := os.ReadFile(layoutPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Layout denah toko belum tersedia. Harap generate data layout terlebih dahulu.",
		})
	}

	var layout models.MapLayout
	if err := json.Unmarshal(fileBytes, &layout); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Gagal membaca format data layout toko.",
		})
	}

	return c.JSON(http.StatusOK, layout)
}

// GetManifest returns available dates and high-level summary
func (h *HeatmapHandler) GetManifest(c echo.Context) error {
	manifestPath := filepath.Join(h.dataDir, "manifest.json")
	fileBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		return c.JSON(http.StatusOK, models.HeatmapManifest{
			AvailableDates: []string{},
			TotalDays:      0,
			DatesSummary:   []models.HeatmapDateSummary{},
			LastUpdated:    "",
		})
	}

	var manifest models.HeatmapManifest
	if err := json.Unmarshal(fileBytes, &manifest); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Gagal membaca manifest tanggal heatmap.",
		})
	}

	return c.JSON(http.StatusOK, manifest)
}

var dateRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// GetDailyData returns shelf event heatmap distribution for a specific date
func (h *HeatmapHandler) GetDailyData(c echo.Context) error {
	dateParam := c.QueryParam("date")
	if dateParam == "" || !dateRegex.MatchString(dateParam) {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Parameter date wajib disertakan dalam format YYYY-MM-DD.",
		})
	}

	dailyPath := filepath.Join(h.dataDir, "daily", dateParam+".json")
	fileBytes, err := os.ReadFile(dailyPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty state payload
			return c.JSON(http.StatusOK, models.DailyHeatmap{
				Date:              dateParam,
				TotalEvents:       0,
				MappedEvents:      0,
				UnmappedEvents:    0,
				MappedPercentage:  0,
				ShelvesTotal:      949,
				ShelvesWithEvents: 0,
				IslesCount:        0,
				AreasCount:        0,
				TopShelf:          nil,
				ActionBreakdown:   map[string]int{},
				ShelfCounts:       map[string]int{},
				AreaSummary:       map[string]models.AreaStat{},
				IsleSummary:       map[string]models.IsleStat{},
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Gagal membaca file data heatmap untuk tanggal: " + dateParam,
		})
	}

	var daily models.DailyHeatmap
	if err := json.Unmarshal(fileBytes, &daily); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Gagal memproses data JSON heatmap tanggal: " + dateParam,
		})
	}

	return c.JSON(http.StatusOK, daily)
}
