package main

import (
	"log"
	"net/http"

	"camtrack-backend/config"
	"camtrack-backend/db"
	appMiddleware "camtrack-backend/middleware"
	"camtrack-backend/handlers"
	"camtrack-backend/models"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.LoadConfig()

	log.Printf("[SERVER] Starting CamTrack Backend on port %s...", cfg.Port)

	// Initialize Database Pool & run migrations + seeder
	pool, err := db.InitDB(cfg)
	if err != nil {
		log.Fatalf("[FATAL] Could not initialize database: %v", err)
	}
	defer pool.Close()

	e := echo.New()
	e.HideBanner = true

	// Standard middlewares
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{"*"},
	}))

	// Handlers
	authHandler := handlers.NewAuthHandler(cfg)
	cameraHandler := handlers.NewCameraHandler()
	formHandler := handlers.NewFormHandler()
	taskHandler := handlers.NewTaskHandler()
	recordHandler := handlers.NewRecordHandler()
	dashHandler := handlers.NewDashboardHandler()
	reportHandler := handlers.NewReportHandler()
	heatmapHandler := handlers.NewHeatmapHandler("data")

	// Healthcheck
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{
			"status":  "healthy",
			"system":  "CamTrack API",
			"version": "1.0.0",
		})
	})

	api := e.Group("/api/v1")

	// Public Auth endpoints
	api.POST("/auth/login", authHandler.Login)
	api.POST("/auth/demo-login", authHandler.DemoLogin)

	// Protected routes
	protected := api.Group("")
	protected.Use(appMiddleware.JWTMiddleware(cfg.JWTSecret))

	// User & Profile
	protected.GET("/auth/me", authHandler.Me)
	protected.GET("/users", authHandler.ListUsers)
	protected.POST("/users", authHandler.CreateUser, appMiddleware.RequireRole(models.RoleAdmin))
	protected.PUT("/users/:id", authHandler.UpdateUser, appMiddleware.RequireRole(models.RoleAdmin))
	protected.DELETE("/users/:id", authHandler.DeleteUser, appMiddleware.RequireRole(models.RoleAdmin))

	// Cameras
	protected.GET("/cameras", cameraHandler.ListCameras)
	protected.GET("/cameras/:id", cameraHandler.GetCamera)
	protected.POST("/cameras", cameraHandler.CreateCamera, appMiddleware.RequireRole(models.RoleAdmin))
	protected.PUT("/cameras/:id", cameraHandler.UpdateCamera, appMiddleware.RequireRole(models.RoleAdmin))
	protected.DELETE("/cameras/:id", cameraHandler.DeleteCamera, appMiddleware.RequireRole(models.RoleAdmin))

	// Form Templates & Versioning
	protected.GET("/form-templates", formHandler.ListTemplates)
	protected.GET("/form-templates/:id", formHandler.GetTemplate)
	protected.POST("/form-templates", formHandler.CreateTemplate, appMiddleware.RequireRole(models.RoleAdmin))
	protected.POST("/form-templates/:id/versions", formHandler.CreateVersion, appMiddleware.RequireRole(models.RoleAdmin))
	protected.GET("/form-templates/:id/versions/:versionId", formHandler.GetVersion)

	// Tasks
	protected.GET("/inspection-tasks", taskHandler.ListTasks)
	protected.GET("/inspection-tasks/:id", taskHandler.GetTask)
	protected.POST("/inspection-tasks", taskHandler.CreateTask, appMiddleware.RequireRole(models.RoleAdmin))
	protected.POST("/inspection-tasks/batch", taskHandler.BatchCreateTasks, appMiddleware.RequireRole(models.RoleAdmin))
	protected.PUT("/inspection-tasks/:id/reassign", taskHandler.ReassignTask, appMiddleware.RequireRole(models.RoleAdmin))
	protected.DELETE("/inspection-tasks/:id", taskHandler.DeleteTask, appMiddleware.RequireRole(models.RoleAdmin))
	protected.POST("/inspection-tasks/:id/draft", taskHandler.SaveDraft)
	protected.POST("/inspection-tasks/:id/submit", taskHandler.SubmitTask)

	// Records & History
	protected.GET("/inspection-records", recordHandler.ListRecords)
	protected.GET("/inspection-records/:id", recordHandler.GetRecord)
	protected.POST("/inspection-records/:id/review", recordHandler.ReviewRecord, appMiddleware.RequireRole(models.RoleSupervisor, models.RoleAdmin))

	// Dashboard & Metrics
	protected.GET("/dashboard/stats", dashHandler.GetStats)
	protected.GET("/dashboard/results-summary", dashHandler.GetResultsSummary)
	protected.GET("/reports/export-csv", reportHandler.ExportCSV)

	// Map Heatmap (Supervisor & Admin)
	protected.GET("/map-heatmap/layout", heatmapHandler.GetLayout, appMiddleware.RequireRole(models.RoleSupervisor, models.RoleAdmin))
	protected.GET("/map-heatmap/manifest", heatmapHandler.GetManifest, appMiddleware.RequireRole(models.RoleSupervisor, models.RoleAdmin))
	protected.GET("/map-heatmap/daily", heatmapHandler.GetDailyData, appMiddleware.RequireRole(models.RoleSupervisor, models.RoleAdmin))

	log.Printf("[SERVER] CamTrack backend listening on :%s", cfg.Port)
	if err := e.Start(":" + cfg.Port); err != nil && err != http.ErrServerClosed {
		log.Fatalf("[FATAL] Server closed: %v", err)
	}
}
