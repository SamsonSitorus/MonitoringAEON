package db

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"camtrack-backend/config"
	"camtrack-backend/models"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var Pool *pgxpool.Pool

func InitDB(cfg *config.Config) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	poolConfig.MaxConns = 15
	poolConfig.MinConns = 2
	poolConfig.MaxConnLifetime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	Pool = pool
	log.Println("[DB] Successfully connected to PostgreSQL (Neon)")

	if err := RunMigrations(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	if err := SeedDefaultData(context.Background()); err != nil {
		log.Printf("[DB] Seed warning: %v\n", err)
	}

	return pool, nil
}

func RunMigrations(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role VARCHAR(32) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE TABLE IF NOT EXISTS cameras (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			code VARCHAR(64) UNIQUE NOT NULL,
			system VARCHAR(64) NOT NULL DEFAULT 'InaAI',
			nvr VARCHAR(128) NOT NULL DEFAULT '',
			channel_no INT DEFAULT 1,
			status VARCHAR(32) DEFAULT 'online',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE TABLE IF NOT EXISTS form_templates (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			code VARCHAR(64) UNIQUE NOT NULL,
			description TEXT,
			is_active BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE TABLE IF NOT EXISTS form_template_versions (
			id VARCHAR(64) PRIMARY KEY,
			template_id VARCHAR(64) NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
			version_number INT NOT NULL,
			schema_json JSONB NOT NULL,
			created_by VARCHAR(64),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(template_id, version_number)
		);`,
		`CREATE TABLE IF NOT EXISTS inspection_tasks (
			id VARCHAR(64) PRIMARY KEY,
			camera_id VARCHAR(64) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
			assigned_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			template_version_id VARCHAR(64) NOT NULL REFERENCES form_template_versions(id) ON DELETE CASCADE,
			status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
			draft_data JSONB DEFAULT '{}'::jsonb,
			target_date DATE DEFAULT CURRENT_DATE,
			target_time_slot VARCHAR(64) DEFAULT '',
			due_date TIMESTAMP WITH TIME ZONE,
			completed_at TIMESTAMP WITH TIME ZONE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE TABLE IF NOT EXISTS inspection_records (
			id VARCHAR(64) PRIMARY KEY,
			task_id VARCHAR(64) NOT NULL REFERENCES inspection_tasks(id) ON DELETE CASCADE,
			camera_id VARCHAR(64) NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
			inspector_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			template_version_id VARCHAR(64) NOT NULL REFERENCES form_template_versions(id) ON DELETE CASCADE,
			payload JSONB NOT NULL,
			notes TEXT,
			target_date DATE DEFAULT CURRENT_DATE,
			target_time_slot VARCHAR(64) DEFAULT '',
			review_status VARCHAR(32) DEFAULT 'PENDING',
			review_notes TEXT,
			reviewer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
			submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			reviewed_at TIMESTAMP WITH TIME ZONE
		);`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id VARCHAR(64) PRIMARY KEY,
			user_id VARCHAR(64),
			action VARCHAR(64) NOT NULL,
			target_type VARCHAR(64) NOT NULL,
			target_id VARCHAR(64),
			details JSONB,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`ALTER TABLE cameras ADD COLUMN IF NOT EXISTS system VARCHAR(64) NOT NULL DEFAULT 'InaAI';`,
		`ALTER TABLE cameras ADD COLUMN IF NOT EXISTS nvr VARCHAR(128) NOT NULL DEFAULT '';`,
		`ALTER TABLE cameras ADD COLUMN IF NOT EXISTS channel_no INT DEFAULT 1;`,
		`ALTER TABLE cameras DROP COLUMN IF EXISTS location;`,
		`ALTER TABLE cameras DROP COLUMN IF EXISTS stream_url;`,
		`ALTER TABLE cameras DROP COLUMN IF EXISTS snapshot_url;`,
		`INSERT INTO form_templates (id, name, code, description, is_active) 
		 VALUES ('tmpl-eval-01', 'Formulir Evaluasi 3 Sample (Traffic, Actions, Demografi)', 'FORM-EVALUATION', 'Format standar evaluasi kamera: verifikasi 3 sample terarah mencakup Traffic (jumlah orang), Actions, Age, dan Gender.', TRUE)
		 ON CONFLICT (id) DO NOTHING;`,
		`INSERT INTO form_template_versions (id, template_id, version_number, schema_json, created_by)
		 VALUES ('ver-eval-01', 'tmpl-eval-01', 1, '{"name": "Evaluasi 3 Sample", "description": "Formulir standar pengecekan 3 sample per kamera", "fields": []}'::jsonb, 'usr-admin-01')
		 ON CONFLICT (id) DO NOTHING;`,
	}

	for _, query := range queries {
		if _, err := Pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("migration failed on query [%s]: %w", query, err)
		}
	}

	log.Println("[DB] Migrations executed successfully")
	return nil
}

func SeedDefaultData(ctx context.Context) error {
	var userCount int
	err := Pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&userCount)
	if err != nil {
		return err
	}
	if userCount > 0 {
		log.Println("[DB] Tables already populated. Skipping initial seed.")
		return nil
	}

	log.Println("[DB] Seeding initial CamTrack demo data...")

	passHash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

	users := []models.User{
		{ID: "usr-admin-01", Name: "Budi Santoso (Admin)", Email: "admin@camtrack.io", PasswordHash: string(passHash), Role: models.RoleAdmin},
		{ID: "usr-insp-01", Name: "Rudi Pratama (Inspector)", Email: "rudi@camtrack.io", PasswordHash: string(passHash), Role: models.RoleInspector},
		{ID: "usr-insp-02", Name: "Siti Rahma (Inspector)", Email: "siti@camtrack.io", PasswordHash: string(passHash), Role: models.RoleInspector},
		{ID: "usr-spv-01", Name: "Hendro Wijaya (Supervisor)", Email: "supervisor@camtrack.io", PasswordHash: string(passHash), Role: models.RoleSupervisor},
	}

	for _, u := range users {
		_, err := Pool.Exec(ctx,
			"INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
			u.ID, u.Name, u.Email, u.PasswordHash, string(u.Role),
		)
		if err != nil {
			log.Printf("Error inserting user %s: %v", u.Email, err)
		}
	}

	cameras := []models.Camera{
		{
			ID:        "cam-001",
			Name:      "Lobby Utama Gedung A",
			Code:      "CAM-LOBBY-A",
			System:    "InaAI",
			NVR:       "NVR1.10.1.6.3",
			ChannelNo: 1,
			Status:    "online",
		},
		{
			ID:        "cam-002",
			Name:      "Pintu Masuk Barat & Gate",
			Code:      "CAM-GATE-WEST",
			System:    "InaAI",
			NVR:       "NVR1.10.1.6.3",
			ChannelNo: 2,
			Status:    "online",
		},
		{
			ID:        "cam-003",
			Name:      "Area Parkir VIP & Staff",
			Code:      "CAM-PARK-B1",
			System:    "InaAI",
			NVR:       "NVR1.10.1.6.4",
			ChannelNo: 1,
			Status:    "online",
		},
		{
			ID:        "cam-004",
			Name:      "Kantin & Food Court Utama",
			Code:      "CAM-CAFETERIA",
			System:    "InaAI",
			NVR:       "NVR1.10.1.6.4",
			ChannelNo: 2,
			Status:    "online",
		},
		{
			ID:        "cam-005",
			Name:      "Koridor Lift Lantai 3",
			Code:      "CAM-LIFT-L3",
			System:    "AEON",
			NVR:       "NVR AEON.10.123.32.20",
			ChannelNo: 1,
			Status:    "online",
		},
		{
			ID:        "cam-006",
			Name:      "Ruang Server & Pusat Kontrol",
			Code:      "CAM-NOC-ROOM",
			System:    "AEON",
			NVR:       "NVR AEON.10.123.32.20",
			ChannelNo: 2,
			Status:    "online",
		},
	}

	for _, c := range cameras {
		_, err := Pool.Exec(ctx,
			"INSERT INTO cameras (id, name, code, system, nvr, channel_no, status) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING",
			c.ID, c.Name, c.Code, c.System, c.NVR, c.ChannelNo, c.Status,
		)
		if err != nil {
			log.Printf("Error inserting camera %s: %v", c.Code, err)
		}
	}

	// 1. Form Template: Penghitungan Orang
	tmpl1 := models.FormTemplate{
		ID:          "tmpl-people-01",
		Name:        "Penghitungan Orang (People Counting)",
		Code:        "FORM-PEOPLE",
		Description: "Pengecekan jumlah pria, wanita, kategori tidak terdefinisi, dan total kepadatan area.",
		IsActive:    true,
	}
	_, _ = Pool.Exec(ctx, "INSERT INTO form_templates (id, name, code, description, is_active) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
		tmpl1.ID, tmpl1.Name, tmpl1.Code, tmpl1.Description, tmpl1.IsActive)

	minVal := float64(0)
	schema1 := models.FormSchema{
		Name:        "Penghitungan Orang",
		Description: "Observasi visual orang yang terlihat di area kamera.",
		Fields: []models.FormField{
			{
				Key:      "observation_time_slot",
				Label:    "Jam / Slot Waktu Pengamatan",
				Type:     "dropdown",
				Required: true,
				Options: []string{
					"07:00 - 08:00 WIB",
					"08:00 - 09:00 WIB",
					"09:00 - 10:00 WIB",
					"10:00 - 11:00 WIB",
					"11:00 - 12:00 WIB",
					"12:00 - 13:00 WIB",
					"13:00 - 14:00 WIB",
					"14:00 - 15:00 WIB",
					"15:00 - 16:00 WIB",
					"16:00 - 17:00 WIB",
					"17:00 - 18:00 WIB",
				},
				HelpText: "Pilih rentang jam rekaman/kamera yang sedang dihitung",
			},
			{
				Key:      "male_count",
				Label:    "Jumlah Pria Teramati",
				Type:     "number",
				Required: true,
				Min:      &minVal,
				HelpText: "Masukkan perkiraan jumlah pria dalam pantauan",
			},
			{
				Key:      "female_count",
				Label:    "Jumlah Wanita Teramati",
				Type:     "number",
				Required: true,
				Min:      &minVal,
				HelpText: "Masukkan perkiraan jumlah wanita dalam pantauan",
			},
			{
				Key:      "unclassified_count",
				Label:    "Jumlah Tidak Terklasifikasi / Samar",
				Type:     "number",
				Required: false,
				Min:      &minVal,
				HelpText: "Gunakan untuk orang yang terhalang atau tidak dapat diidentifikasi",
			},
			{
				Key:      "total_people",
				Label:    "Total Orang Terhitung (Formula Otomatis)",
				Type:     "formula",
				Formula:  "{male_count} + {female_count} + {unclassified_count}",
				HelpText: "Dihitung otomatis oleh sistem",
			},
			{
				Key:      "density_level",
				Label:    "Kondisi Kepadatan Area",
				Type:     "dropdown",
				Required: true,
				Options:  []string{"Lancar / Sepi (0-10)", "Sedang (11-30)", "Padat (31-50)", "Sangat Penuh (>50)"},
			},
			{
				Key:         "operator_notes",
				Label:       "Catatan Observasi Tambahan",
				Type:        "text",
				Required:    false,
				Placeholder: "Misal: Arus masuk sedang meningkat jelang jam makan siang...",
			},
		},
	}
	schema1Bytes, _ := json.Marshal(schema1)
	_, _ = Pool.Exec(ctx,
		"INSERT INTO form_template_versions (id, template_id, version_number, schema_json, created_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
		"ver-people-01", tmpl1.ID, 1, schema1Bytes, "usr-admin-01",
	)

	// Seed Sample Tasks
	now := time.Now()
	due := now.Add(4 * time.Hour)

	tasks := []struct {
		id, camID, userID, verID string
		status                   models.TaskStatus
		draft                    string
		completedAt              *time.Time
	}{
		{"tsk-101", "cam-001", "usr-insp-01", "ver-people-01", models.TaskStatusDone, "{}", &now},
		{"tsk-102", "cam-002", "usr-insp-01", "ver-people-01", models.TaskStatusDone, "{}", &now},
		{"tsk-103", "cam-003", "usr-insp-01", "ver-people-01", models.TaskStatusInProgress, `{"male_count": 8, "female_count": 5}`, nil},
		{"tsk-104", "cam-004", "usr-insp-01", "ver-people-01", models.TaskStatusNotStarted, "{}", nil},
		{"tsk-105", "cam-005", "usr-insp-02", "ver-activity-01", models.TaskStatusDone, "{}", &now},
		{"tsk-106", "cam-006", "usr-insp-02", "ver-condition-01", models.TaskStatusRevisionNeeded, "{}", nil},
		{"tsk-107", "cam-001", "usr-insp-02", "ver-condition-01", models.TaskStatusNotStarted, "{}", nil},
		{"tsk-108", "cam-002", "usr-insp-02", "ver-condition-01", models.TaskStatusNotStarted, "{}", nil},
	}

	for _, t := range tasks {
		_, _ = Pool.Exec(ctx,
			`INSERT INTO inspection_tasks (id, camera_id, assigned_user_id, template_version_id, status, draft_data, target_date, target_time_slot, due_date, completed_at)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_DATE, '08:00 - 09:00 WIB', $7, $8) ON CONFLICT (id) DO NOTHING`,
			t.id, t.camID, t.userID, t.verID, string(t.status), t.draft, due, t.completedAt,
		)
	}

	// Seed Inspection Records for the Done tasks
	records := []struct {
		id, taskID, camID, inspectorID, verID string
		payload                               string
		notes                                 string
		reviewStatus                          string
		reviewNotes                           string
	}{
		{
			id:           "rec-201",
			taskID:       "tsk-101",
			camID:        "cam-001",
			inspectorID:  "usr-insp-01",
			verID:        "ver-people-01",
			payload:      `{"observation_time_slot": "08:00 - 09:00 WIB", "male_count": 15, "female_count": 8, "unclassified_count": 1, "total_people": 24, "density_level": "Sedang (11-30)", "operator_notes": "Kondisi arus masuk normal."}`,
			notes:        "Pengecekan shift pagi selesai tanpa kendala",
			reviewStatus: "APPROVED",
			reviewNotes:  "Data konsisten dengan rata-rata jam sibuk.",
		},
		{
			id:           "rec-202",
			taskID:       "tsk-102",
			camID:        "cam-002",
			inspectorID:  "usr-insp-01",
			verID:        "ver-people-01",
			payload:      `{"observation_time_slot": "09:00 - 10:00 WIB", "male_count": 22, "female_count": 14, "unclassified_count": 0, "total_people": 36, "density_level": "Padat (31-50)", "operator_notes": "Banyak pengunjung menunggu di depan gate."}`,
			notes:        "Gate barat terlihat antrean",
			reviewStatus: "APPROVED",
			reviewNotes:  "Terima kasih atas laporannya.",
		},
		{
			id:           "rec-203",
			taskID:       "tsk-105",
			camID:        "cam-005",
			inspectorID:  "usr-insp-02",
			verID:        "ver-activity-01",
			payload:      `{"activity_occurred": false, "area_status": "Aman & Terkendali", "activity_notes": "Koridor lift bersih dan aman."}`,
			notes:        "Semua normal",
			reviewStatus: "PENDING",
			reviewNotes:  "",
		},
	}

	for _, r := range records {
		_, _ = Pool.Exec(ctx,
			`INSERT INTO inspection_records (id, task_id, camera_id, inspector_id, template_version_id, payload, notes, target_date, target_time_slot, review_status, review_notes)
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, CURRENT_DATE, '08:00 - 09:00 WIB', $8, $9) ON CONFLICT (id) DO NOTHING`,
			r.id, r.taskID, r.camID, r.inspectorID, r.verID, r.payload, r.notes, r.reviewStatus, r.reviewNotes,
		)
	}

	log.Println("[DB] Initial demo data seeded successfully!")
	return nil
}
