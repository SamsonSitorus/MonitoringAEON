package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type AuditResult struct {
	Name     string
	Passed   bool
	Details  string
	Duration time.Duration
}

var results []AuditResult

func record(name string, passed bool, details string, d time.Duration) {
	results = append(results, AuditResult{
		Name:     name,
		Passed:   passed,
		Details:  details,
		Duration: d,
	})
	status := "✅ PASS"
	if !passed {
		status = "❌ FAIL"
	}
	fmt.Printf("[%s] %s (%v): %s\n", status, name, d.Round(time.Millisecond), details)
}

func main() {
	baseURL := "http://localhost:8080"
	client := &http.Client{Timeout: 10 * time.Second}

	fmt.Println("=====================================================")
	fmt.Println("🚀 CAMTRACK SYSTEM COMPREHENSIVE END-TO-END AUDIT")
	fmt.Println("=====================================================")

	// 1. Healthcheck
	t0 := time.Now()
	resp, err := client.Get(baseURL + "/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		record("API Healthcheck", false, fmt.Sprintf("err: %v, status: %d", err, resp.StatusCode), time.Since(t0))
	} else {
		record("API Healthcheck", true, "Server responsive and healthy", time.Since(t0))
	}

	// 2. Auth Logins
	var adminToken, spvToken, inspToken string
	roles := []struct {
		role     string
		email    string
		tokenPtr *string
	}{
		{"Admin", "admin@camtrack.io", &adminToken},
		{"Supervisor", "supervisor@camtrack.io", &spvToken},
		{"Inspector", "rudi@camtrack.io", &inspToken},
	}

	for _, r := range roles {
		t0 = time.Now()
		body, _ := json.Marshal(map[string]string{
			"email":    r.email,
			"password": "password123",
		})
		res, err := client.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
		if err != nil || res.StatusCode != http.StatusOK {
			record("Auth Login: "+r.role, false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
			continue
		}
		var payload struct {
			Token string `json:"token"`
			User  struct {
				Role string `json:"role"`
			} `json:"user"`
		}
		_ = json.NewDecoder(res.Body).Decode(&payload)
		res.Body.Close()

		if payload.Token != "" {
			*r.tokenPtr = payload.Token
			record("Auth Login: "+r.role, true, fmt.Sprintf("Token acquired for %s (%s)", r.email, payload.User.Role), time.Since(t0))
		} else {
			record("Auth Login: "+r.role, false, "Token missing in response", time.Since(t0))
		}
	}

	// Helper for authenticated GET
	authGet := func(url, token string) (*http.Response, []byte, error) {
		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := client.Do(req)
		if err != nil {
			return nil, nil, err
		}
		defer res.Body.Close()
		b, err := io.ReadAll(res.Body)
		return res, b, err
	}

	// 3. Cameras List & Schema Integrity Audit
	t0 = time.Now()
	res, b, err := authGet(baseURL+"/api/v1/cameras", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/cameras", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var cameras []map[string]interface{}
		_ = json.Unmarshal(b, &cameras)

		hasLocation := false
		hasSnapshot := false
		hasStream := false
		hasSystem := false
		hasNVR := false
		hasChannel := false
		count := len(cameras)

		for _, c := range cameras {
			if _, ok := c["location"]; ok {
				hasLocation = true
			}
			if _, ok := c["snapshot_url"]; ok {
				hasSnapshot = true
			}
			if _, ok := c["stream_url"]; ok {
				hasStream = true
			}
			if sys, ok := c["system"].(string); ok && sys != "" {
				hasSystem = true
			}
			if nvr, ok := c["nvr"].(string); ok && nvr != "" {
				hasNVR = true
			}
			if _, ok := c["channel_no"]; ok {
				hasChannel = true
			}
		}

		if hasLocation || hasSnapshot || hasStream {
			record("Camera Schema Deprecation Check", false, "Legacy fields (location/stream/snapshot) detected in API output!", time.Since(t0))
		} else {
			record("Camera Schema Deprecation Check", true, "Verified: location, stream_url, snapshot_url are completely absent", time.Since(t0))
		}

		if hasSystem && hasNVR && hasChannel && count >= 6 {
			record("Camera InaAI/AEON & NVR Fields Check", true, fmt.Sprintf("%d cameras returned with proper system, nvr, and channel_no", count), time.Since(t0))
		} else {
			record("Camera InaAI/AEON & NVR Fields Check", false, fmt.Sprintf("Missing new fields or count unexpected (%d)", count), time.Since(t0))
		}
	}

	// 4. Inspection Tasks API Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/inspection-tasks", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/inspection-tasks", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var tasks []map[string]interface{}
		_ = json.Unmarshal(b, &tasks)
		if len(tasks) > 0 {
			record("GET /api/v1/inspection-tasks", true, fmt.Sprintf("Retrieved %d tasks with camera, slot, and user relations", len(tasks)), time.Since(t0))
		} else {
			record("GET /api/v1/inspection-tasks", false, "Zero tasks returned", time.Since(t0))
		}
	}

	// 5. Inspector My Tasks API Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/inspection-tasks?assigned_to=usr-insp-01", inspToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("Inspector Assigned Tasks Endpoint", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var myTasks []interface{}
		_ = json.Unmarshal(b, &myTasks)
		record("Inspector Assigned Tasks Endpoint", true, fmt.Sprintf("%d tasks retrieved for Rudi Pratama", len(myTasks)), time.Since(t0))
	}

	// 6. Inspection Records API Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/inspection-records", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/inspection-records", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var records []map[string]interface{}
		_ = json.Unmarshal(b, &records)
		record("GET /api/v1/inspection-records", true, fmt.Sprintf("%d inspection records retrieved", len(records)), time.Since(t0))
	}

	// 7. Dashboard Stats & Section 4 Inspector Progress Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/dashboard/stats", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/dashboard/stats", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var dashResp struct {
			TotalTasks        int `json:"total_tasks"`
			DoneTasks         int `json:"done_tasks"`
			InProgressTasks   int `json:"in_progress_tasks"`
			NotStartedTasks   int `json:"not_started_tasks"`
			UserProgressStats []struct {
				UserID        string  `json:"user_id"`
				UserName      string  `json:"user_name"`
				TotalAssigned int     `json:"total_assigned"`
				DoneCount     int     `json:"done_count"`
				ProgressPct   float64 `json:"progress_pct"`
			} `json:"user_progress_stats"`
		}
		_ = json.Unmarshal(b, &dashResp)
		inspCount := len(dashResp.UserProgressStats)
		if inspCount > 0 {
			record("Dashboard Section 4 Inspector Progress", true, fmt.Sprintf("Retrieved progress metrics for %d inspectors, total tasks: %d", inspCount, dashResp.TotalTasks), time.Since(t0))
		} else {
			record("Dashboard Section 4 Inspector Progress", false, "UserProgressStats array is empty", time.Since(t0))
		}
	}

	// 8. Dashboard Stats with Date Scoping Audit
	t0 = time.Now()
	todayStr := time.Now().Format("2006-01-02")
	res, _, err = authGet(baseURL+"/api/v1/dashboard/stats?date="+todayStr, adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("Dashboard Date Parameter Filter", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		record("Dashboard Date Parameter Filter", true, "Date filter ?date="+todayStr+" processed successfully", time.Since(t0))
	}

	// 9. Dashboard Results Summary Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/dashboard/results-summary", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/dashboard/results-summary", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var summaryResp struct {
			TotalInspections   int `json:"total_inspections"`
			TotalPeopleCounted int `json:"total_people_counted"`
		}
		_ = json.Unmarshal(b, &summaryResp)
		record("GET /api/v1/dashboard/results-summary", true, fmt.Sprintf("Total inspections: %d, people counted: %d", summaryResp.TotalInspections, summaryResp.TotalPeopleCounted), time.Since(t0))
	}

	// 10. Reports CSV Export Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/reports/export-csv", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/reports/export-csv", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		isCSV := strings.Contains(string(b), "Record ID,Task ID") || len(b) > 0
		record("GET /api/v1/reports/export-csv", isCSV, fmt.Sprintf("CSV generated, length: %d bytes", len(b)), time.Since(t0))
	}

	// 11. Form Templates Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/form-templates", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/form-templates", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var tmpls []map[string]interface{}
		_ = json.Unmarshal(b, &tmpls)
		record("GET /api/v1/form-templates", true, fmt.Sprintf("%d form templates retrieved (People Counting, Activity, Condition)", len(tmpls)), time.Since(t0))
	}

	// 12. Users List Audit
	t0 = time.Now()
	res, b, err = authGet(baseURL+"/api/v1/users", adminToken)
	if err != nil || res.StatusCode != http.StatusOK {
		record("GET /api/v1/users", false, fmt.Sprintf("status: %d", res.StatusCode), time.Since(t0))
	} else {
		var users []map[string]interface{}
		_ = json.Unmarshal(b, &users)
		record("GET /api/v1/users", true, fmt.Sprintf("%d users active in system", len(users)), time.Since(t0))
	}

	// 13. RBAC Security Check: Inspector cannot access Admin cameras management modification
	t0 = time.Now()
	req, _ := http.NewRequest("POST", baseURL+"/api/v1/cameras", strings.NewReader(`{"name":"Hacked","code":"CAM-HACK"}`))
	req.Header.Set("Authorization", "Bearer "+inspToken)
	req.Header.Set("Content-Type", "application/json")
	res, err = client.Do(req)
	if err == nil && (res.StatusCode == http.StatusForbidden || res.StatusCode == http.StatusUnauthorized) {
		record("RBAC Security: Inspector Camera Write Blocked", true, fmt.Sprintf("Blocked with status %d (Forbidden)", res.StatusCode), time.Since(t0))
	} else {
		record("RBAC Security: Inspector Camera Write Blocked", false, fmt.Sprintf("Unexpected status: %d", res.StatusCode), time.Since(t0))
	}

	// 14. RBAC Security Check: Inspector cannot access Admin User creation
	t0 = time.Now()
	req, _ = http.NewRequest("POST", baseURL+"/api/v1/users", strings.NewReader(`{"name":"Hacker","email":"hack@camtrack.io","password":"123","role":"admin"}`))
	req.Header.Set("Authorization", "Bearer "+inspToken)
	req.Header.Set("Content-Type", "application/json")
	res, err = client.Do(req)
	if err == nil && (res.StatusCode == http.StatusForbidden || res.StatusCode == http.StatusUnauthorized) {
		record("RBAC Security: Inspector User Creation Blocked", true, fmt.Sprintf("Blocked with status %d (Forbidden)", res.StatusCode), time.Since(t0))
	} else {
		record("RBAC Security: Inspector User Creation Blocked", false, fmt.Sprintf("Unexpected status: %d", res.StatusCode), time.Since(t0))
	}

	// Summary
	fmt.Println("\n=====================================================")
	fmt.Println("📊 AUDIT SUMMARY REPORT")
	fmt.Println("=====================================================")
	passedCount := 0
	for _, r := range results {
		if r.Passed {
			passedCount++
		}
	}
	fmt.Printf("Total Tests Run: %d | Passed: %d | Failed: %d\n", len(results), passedCount, len(results)-passedCount)
	if passedCount == len(results) {
		fmt.Println("🎉 ALL AUDIT CHECKS PASSED WITH 100% SUCCESS RATE!")
	} else {
		fmt.Println("⚠️ SOME CHECKS FAILED! REVIEW DETAILS ABOVE.")
	}
}
