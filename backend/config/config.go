package config

import (
	"bufio"
	"log"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	Port        string
	JWTSecret   string
	AppEnv      string
}

// loadDotEnv parses key=val from a .env file and sets them in os.Setenv if not already set
func loadDotEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return // .env file not found, fall back to system env
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			// remove quotes if any
			val = strings.Trim(val, `"'`)
			if os.Getenv(key) == "" {
				_ = os.Setenv(key, val)
			}
		}
	}
	log.Printf("[CONFIG] Loaded environment variables from %s", filepath)
}

func LoadConfig() *Config {
	loadDotEnv(".env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://neondb_owner:npg_Zj87klREtscS@ep-still-shadow-b4s8inpb-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
	}
	// Clean up any channel_binding parameter if present as pgx handles standard SSL
	if strings.Contains(dbURL, "channel_binding=") {
		dbURL = strings.ReplaceAll(dbURL, "&channel_binding=require", "")
		dbURL = strings.ReplaceAll(dbURL, "channel_binding=require&", "")
		dbURL = strings.ReplaceAll(dbURL, "channel_binding=require", "")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "camtrack-super-secure-jwt-key-2026"
	}

	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}

	return &Config{
		DatabaseURL: dbURL,
		Port:        port,
		JWTSecret:   jwtSecret,
		AppEnv:      appEnv,
	}
}
