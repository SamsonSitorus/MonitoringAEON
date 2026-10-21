# CamTrack — Dynamic Camera Inspection & Progress Monitoring

Sistem inspeksi kamera CCTV dinamis, distribusi tugas observasi visual, dan pemantauan progres real-time berbasis Web.

---

## 1. Konsep & Filosofi Inti

Aplikasi ini membedakan dua metrik secara tegas:
1. **Progress Pengecekan (Task Completion Metric)**:
   - Dihitung dari rasio tugas yang sudah diselesaikan personil:
     $$\text{Progress} = \frac{\text{Jumlah Task Done}}{\text{Total Task Ditugaskan}} \times 100\%$$
   - Tidak tergantung pada berapa banyak field di dalam form.
2. **Hasil Observasi (Inspection Payload Metric)**:
   - Data dinamis terstruktur (misal: jumlah orang pria/wanita, kepadatan, status kerusakan kamera, foto bukti) yang disimpan sebagai dokumen `JSONB` di PostgreSQL.

### Dynamic Form & Immutable Versioning
Ketika Admin memperbarui field pada form pengecekan (misal menambahkan field kendaraan atau foto bukti):
- Sistem **tidak menimpa** form lama, melainkan menerbitkan **versi baru** (v2, v3, dst).
- Data historis yang diisi menggunakan v1 tetap utuh dan divalidasi menggunakan skema v1.
- Task baru akan menggunakan versi terbaru.

---

## 2. Arsitektur & Teknologi

* **Backend**: Go 1.25, Framework Echo v4, Database Driver `pgx/v5`, JWT Authentication, Bcrypt.
* **Frontend**: React 19, TypeScript, Vite, Vanilla CSS Design System (Glassmorphic dark mode, Inter typography, animasi mikro).
* **Database**: PostgreSQL (Neon Cloud) dengan kombinasi tabel relasional dan JSONB.

### Koneksi Database (Neon Cloud)
```env
DATABASE_URL='postgresql://neondb_owner:npg_Zj87klREtscS@ep-still-shadow-b4s8inpb-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require'
```

---

## 3. Akun Pengguna & Persona Pengujian (Demo Login)

Aplikasi dilengkapi dengan **Quick Persona Switcher** di navigasi atas:

| Role | Akun Demo | Email | Akses & Fungsionalitas |
| :--- | :--- | :--- | :--- |
| **Admin** | Budi Santoso | `admin@camtrack.io` | Master Kamera, Form Builder Dinamis, Task Assignment (Batch), Dashboard Global. |
| **Inspector 1** | Rudi Pratama | `rudi@camtrack.io` | Melihat antrean tugas saya, Live Snapshot CCTV, Pengisian Dynamic Form, Simpan Draft, Submit Hasil. |
| **Inspector 2** | Siti Rahma | `siti@camtrack.io` | Tugas pengecekan aktivitas & anomali, penanganan revisi inspeksi. |
| **Supervisor** | Hendro Wijaya | `supervisor@camtrack.io` | Monitoring progress tim, Review hasil inspeksi (Approve / Request Revision), Ekspor Laporan CSV. |

*Password untuk semua akun demo:* `password123`

---

## 4. Cara Menjalankan Aplikasi

### Menjalankan Backend (Go + Echo)
```bash
cd backend
go run main.go
# Server berjalan di http://localhost:8080
```

### Menjalankan Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Frontend berjalan di http://localhost:5173
```

---

## 5. Ringkasan Endpoint API (v1)

### Autentikasi & Akun
- `POST /api/v1/auth/login` — Login pengguna
- `POST /api/v1/auth/demo-login` — Beralih persona instan
- `GET /api/v1/auth/me` — Profil pengguna aktif
- `GET /api/v1/users` — Daftar pengguna (filter by role)

### Master Kamera
- `GET /api/v1/cameras` — Daftar kamera CCTV
- `POST /api/v1/cameras` — Tambah kamera baru (Admin)
- `PUT /api/v1/cameras/:id` — Update kamera (Admin)
- `DELETE /api/v1/cameras/:id` — Hapus kamera (Admin)

### Form Builder & Versioning
- `GET /api/v1/form-templates` — Daftar template form & versi aktif
- `GET /api/v1/form-templates/:id` — Detail template beserta riwayat versi
- `POST /api/v1/form-templates` — Buat template & versi 1 (Admin)
- `POST /api/v1/form-templates/:id/versions` — Publikasikan versi form baru (Admin)

### Penugasan & Pengecekan (Tasks)
- `GET /api/v1/inspection-tasks` — Daftar tugas (filter: `assigned_to`, `status`, `camera_id`)
- `GET /api/v1/inspection-tasks/:id` — Detail tugas & skema dynamic form
- `POST /api/v1/inspection-tasks/batch` — Penugasan kamera massal (Admin)
- `POST /api/v1/inspection-tasks/:id/draft` — Simpan draft pengerjaan
- `POST /api/v1/inspection-tasks/:id/submit` — Submit hasil observasi (Validasi skema, kunci tugas, ubah status ke `DONE`)

### Review & Verifikasi Supervisor
- `GET /api/v1/inspection-records` — Riwayat hasil observasi (JSONB payload)
- `POST /api/v1/inspection-records/:id/review` — Review status (`APPROVED` / `REVISION_REQUESTED`)

### Dashboard & Laporan
- `GET /api/v1/dashboard/stats` — Metrik persentase task completion, progress per user, status kamera
- `GET /api/v1/dashboard/results-summary` — Agregasi data hasil (total orang, pria, wanita, temuan masalah)
- `GET /api/v1/reports/export-csv` — Unduh laporan lengkap dalam format CSV
