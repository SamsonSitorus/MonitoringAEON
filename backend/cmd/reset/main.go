package main

import (
	"context"
	"log"
	"time"

	"camtrack-backend/config"
	"camtrack-backend/db"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.LoadConfig()
	log.Println("[MIGRATE-RESET] Starting database migration & reset...")

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[MIGRATE-RESET] Failed to parse database URL: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("[MIGRATE-RESET] Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("[MIGRATE-RESET] Ping failed: %v", err)
	}

	db.Pool = pool

	log.Println("[MIGRATE-RESET] Dropping existing tables (CASCADE)...")
	dropQueries := []string{
		"DROP TABLE IF EXISTS audit_logs CASCADE;",
		"DROP TABLE IF EXISTS inspection_records CASCADE;",
		"DROP TABLE IF EXISTS inspection_tasks CASCADE;",
		"DROP TABLE IF EXISTS form_template_versions CASCADE;",
		"DROP TABLE IF EXISTS form_templates CASCADE;",
		"DROP TABLE IF EXISTS cameras CASCADE;",
		"DROP TABLE IF EXISTS users CASCADE;",
	}

	for _, q := range dropQueries {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Fatalf("[MIGRATE-RESET] Error dropping table with query [%s]: %v", q, err)
		}
	}
	log.Println("[MIGRATE-RESET] All existing tables dropped cleanly.")

	log.Println("[MIGRATE-RESET] Running migrations (creating fresh tables)...")
	if err := db.RunMigrations(ctx); err != nil {
		log.Fatalf("[MIGRATE-RESET] RunMigrations failed: %v", err)
	}

	log.Println("[MIGRATE-RESET] Seeding initial data (InaAI & AEON cameras, templates, users, tasks)...")
	if err := db.SeedDefaultData(ctx); err != nil {
		log.Fatalf("[MIGRATE-RESET] SeedDefaultData failed: %v", err)
	}

	log.Println("[MIGRATE-RESET] Database re-migration and re-seeding completed successfully! 🎉")
}
