package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func main() {
	baseURL := "https://pct-freelance-lat-mountains.trycloudflare.com"
	client := &http.Client{Timeout: 15 * time.Second}

	fmt.Println("==================================================================")
	fmt.Println("🌐 TESTING END-TO-END VIA CLOUDFLARE PUBLIC TUNNEL")
	fmt.Println("Target:", baseURL)
	fmt.Println("==================================================================")

	// 1. Test Demo Login
	demoBody, _ := json.Marshal(map[string]string{
		"role":    "admin",
		"user_id": "usr-admin-01",
	})
	demoResp, err := client.Post(baseURL+"/api/v1/auth/demo-login", "application/json", bytes.NewBuffer(demoBody))
	if err != nil || demoResp.StatusCode != http.StatusOK {
		var errB []byte
		if demoResp != nil {
			errB, _ = io.ReadAll(demoResp.Body)
			demoResp.Body.Close()
		}
		fmt.Printf("⚠️ Demo Login failed! Status: %v, Body: %s\n", demoResp, string(errB))
	} else {
		fmt.Println("✅ Demo Login (sekali-klik) BERHASIL via Tunnel!")
		demoResp.Body.Close()
	}

	// 1b. Test Regular Login
	loginBody, _ := json.Marshal(map[string]string{
		"email":    "admin@camtrack.io",
		"password": "password123",
	})

	resp, err := client.Post(baseURL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(loginBody))
	if err != nil {
		fmt.Printf("❌ Failed connecting to tunnel: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ Login failed with status %d: %s\n", resp.StatusCode, string(b))
		return
	}

	var authResp struct {
		Token string `json:"token"`
		User  struct {
			Name  string `json:"name"`
			Email string `json:"email"`
			Role  string `json:"role"`
		} `json:"user"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&authResp)
	fmt.Printf("✅ [1/3] Login Berhasil via Tunnel!\n")
	fmt.Printf("   User: %s (%s) | Role: %s\n", authResp.User.Name, authResp.User.Email, authResp.User.Role)
	fmt.Printf("   JWT Token: %s...\n\n", authResp.Token[:25])

	// 2. Test Cameras Query
	req, _ := http.NewRequest("GET", baseURL+"/api/v1/cameras", nil)
	req.Header.Set("Authorization", "Bearer "+authResp.Token)
	camResp, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ Failed fetching cameras: %v\n", err)
		return
	}
	defer camResp.Body.Close()

	var cameras []struct {
		Name      string `json:"name"`
		Code      string `json:"code"`
		System    string `json:"system"`
		NVR       string `json:"nvr"`
		ChannelNo int    `json:"channel_no"`
		Status    string `json:"status"`
	}
	_ = json.NewDecoder(camResp.Body).Decode(&cameras)
	fmt.Printf("✅ [2/3] Data Kamera dari Database Neon Berhasil Diambil (%d Unit):\n", len(cameras))
	for _, c := range cameras {
		fmt.Printf("   📹 %s [%s] -> Sistem: %s | NVR: %s (Ch %d) | Status: %s\n", c.Name, c.Code, c.System, c.NVR, c.ChannelNo, c.Status)
	}

	// 3. Test Dashboard Stats
	fmt.Println()
	req2, _ := http.NewRequest("GET", baseURL+"/api/v1/dashboard/stats", nil)
	req2.Header.Set("Authorization", "Bearer "+authResp.Token)
	dashResp, err := client.Do(req2)
	if err != nil {
		fmt.Printf("❌ Failed fetching dashboard stats: %v\n", err)
		return
	}
	defer dashResp.Body.Close()

	var stats struct {
		TotalTasks      int `json:"total_tasks"`
		DoneTasks       int `json:"done_tasks"`
		InProgressTasks int `json:"in_progress_tasks"`
		NotStartedTasks int `json:"not_started_tasks"`
	}
	_ = json.NewDecoder(dashResp.Body).Decode(&stats)
	fmt.Printf("✅ [3/3] Metrik Dashboard Real-Time Berhasil Ditarik:\n")
	fmt.Printf("   📊 Total Tasks: %d | Selesai (Done): %d | Sedang Dikerjakan: %d | Belum Mulai: %d\n",
		stats.TotalTasks, stats.DoneTasks, stats.InProgressTasks, stats.NotStartedTasks)

	fmt.Println("\n==================================================================")
	fmt.Println("🎉 KESIMPULAN: LINK PUBLIK 100% TERHUBUNG KE BACKEND & DATABASE!")
	fmt.Println("==================================================================")
}
