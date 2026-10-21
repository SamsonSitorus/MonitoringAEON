package handlers

import (
	"context"
	"net/http"
	"time"

	"camtrack-backend/config"
	"camtrack-backend/db"
	"camtrack-backend/middleware"
	"camtrack-backend/models"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type DemoLoginRequest struct {
	Role   models.UserRole `json:"role"`
	UserID string          `json:"user_id"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

type CreateUserRequest struct {
	Name     string          `json:"name"`
	Email    string          `json:"email"`
	Password string          `json:"password"`
	Role     models.UserRole `json:"role"`
}

type UpdateUserRequest struct {
	Name     string          `json:"name"`
	Email    string          `json:"email"`
	Password string          `json:"password,omitempty"`
	Role     models.UserRole `json:"role"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.Email == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Email dan password wajib diisi")
	}

	var user models.User
	query := "SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1"
	err := db.Pool.QueryRow(context.Background(), query, req.Email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Email atau kata sandi tidak valid")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Email atau kata sandi tidak valid")
	}

	token, err := middleware.GenerateToken(&user, h.cfg.JWTSecret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal menghasilkan token autentikasi")
	}

	return c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  user,
	})
}

// DemoLogin allows instantly switching personas in the application UI
func (h *AuthHandler) DemoLogin(c echo.Context) error {
	var req DemoLoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	var user models.User
	var err error
	if req.UserID != "" {
		query := "SELECT id, name, email, password_hash, role, created_at FROM users WHERE id = $1"
		err = db.Pool.QueryRow(context.Background(), query, req.UserID).Scan(
			&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt,
		)
	} else if req.Role != "" {
		query := "SELECT id, name, email, password_hash, role, created_at FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1"
		err = db.Pool.QueryRow(context.Background(), query, string(req.Role)).Scan(
			&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.CreatedAt,
		)
	} else {
		return echo.NewHTTPError(http.StatusBadRequest, "Provide either user_id or role")
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "Demo user not found")
	}

	token, err := middleware.GenerateToken(&user, h.cfg.JWTSecret)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to generate token")
	}

	return c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  user,
	})
}

func (h *AuthHandler) Me(c echo.Context) error {
	claims := middleware.GetUserFromContext(c)
	if claims == nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized")
	}

	var user models.User
	query := "SELECT id, name, email, role, created_at FROM users WHERE id = $1"
	err := db.Pool.QueryRow(context.Background(), query, claims.UserID).Scan(
		&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "User not found")
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) ListUsers(c echo.Context) error {
	roleFilter := c.QueryParam("role")

	query := "SELECT id, name, email, role, created_at FROM users"
	var args []any
	if roleFilter != "" {
		query += " WHERE role = $1"
		args = append(args, roleFilter)
	}
	query += " ORDER BY role ASC, name ASC"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.CreatedAt); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
		}
		users = append(users, u)
	}

	return c.JSON(http.StatusOK, users)
}

func (h *AuthHandler) CreateUser(c echo.Context) error {
	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.Name == "" || req.Email == "" || req.Password == "" || req.Role == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Nama, email, password, dan role wajib diisi")
	}

	// Check if email already exists
	var existing int
	_ = db.Pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM users WHERE email = $1", req.Email).Scan(&existing)
	if existing > 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "Email sudah terdaftar dalam sistem")
	}

	passHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal memproses kata sandi")
	}

	id := "usr-" + uuid.New().String()[:8]
	now := time.Now()

	query := `
		INSERT INTO users (id, name, email, password_hash, role, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, email, role, created_at
	`
	var user models.User
	err = db.Pool.QueryRow(context.Background(), query, id, req.Name, req.Email, string(passHash), string(req.Role), now).Scan(
		&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal membuat pengguna: "+err.Error())
	}

	return c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) UpdateUser(c echo.Context) error {
	id := c.Param("id")
	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	if req.Password != "" {
		passHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Gagal memproses password")
		}
		query := `
			UPDATE users
			SET name = COALESCE(NULLIF($1, ''), name),
			    email = COALESCE(NULLIF($2, ''), email),
			    role = COALESCE(NULLIF($3, ''), role),
			    password_hash = $4
			WHERE id = $5
			RETURNING id, name, email, role, created_at
		`
		var user models.User
		err = db.Pool.QueryRow(context.Background(), query, req.Name, req.Email, string(req.Role), string(passHash), id).Scan(
			&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt,
		)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "Gagal memperbarui user: "+err.Error())
		}
		return c.JSON(http.StatusOK, user)
	}

	query := `
		UPDATE users
		SET name = COALESCE(NULLIF($1, ''), name),
		    email = COALESCE(NULLIF($2, ''), email),
		    role = COALESCE(NULLIF($3, ''), role)
		WHERE id = $4
		RETURNING id, name, email, role, created_at
	`
	var user models.User
	err := db.Pool.QueryRow(context.Background(), query, req.Name, req.Email, string(req.Role), id).Scan(
		&user.ID, &user.Name, &user.Email, &user.Role, &user.CreatedAt,
	)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal memperbarui user: "+err.Error())
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) DeleteUser(c echo.Context) error {
	id := c.Param("id")

	claims := middleware.GetUserFromContext(c)
	if claims != nil && claims.UserID == id {
		return echo.NewHTTPError(http.StatusBadRequest, "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif")
	}

	_, err := db.Pool.Exec(context.Background(), "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Gagal menghapus pengguna: "+err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}
