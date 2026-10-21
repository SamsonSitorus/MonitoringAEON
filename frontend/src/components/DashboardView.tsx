import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ListTodo, 
  Users, 
  Camera, 
  TrendingUp, 
  RefreshCw, 
  AlertTriangle, 
  FileCheck, 
  Calendar, 
  CalendarDays, 
  Search, 
  X, 
  Filter 
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, ResultsSummary, InspectionRecord } from '../types';
import { Pagination } from './Pagination';

interface HourlyBucket {
  hour: number;
  hourLabel: string;
  totalPeople: number;
  maleCount: number;
  femaleCount: number;
  unclassifiedCount: number;
  inspectionCount: number;
  cameras: string[];
}

type DatePreset = 'TODAY' | 'YESTERDAY' | 'ALL' | 'CUSTOM';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<ResultsSummary | null>(null);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyBucket[]>([]);
  const [peakHour, setPeakHour] = useState<HourlyBucket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Date Scoping Filter for Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [customDate, setCustomDate] = useState<string>('');

  // User Section 4 Controls
  const [onlyActiveInspectors, setOnlyActiveInspectors] = useState<boolean>(true);
  const [searchUser, setSearchUser] = useState<string>('');
  const [sortBy, setSortBy] = useState<'ATTENTION' | 'PROGRESS_ASC' | 'PROGRESS_DESC' | 'NAME'>('ATTENTION');
  const [userCurrentPage, setUserCurrentPage] = useState<number>(1);
  const [userPageSize, setUserPageSize] = useState<number>(5);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const effectiveDate = 
    datePreset === 'TODAY' ? getTodayStr() :
    datePreset === 'YESTERDAY' ? getYesterdayStr() :
    datePreset === 'CUSTOM' ? customDate : '';

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sData, rData, recData] = await Promise.all([
        api.getDashboardStats(effectiveDate),
        api.getResultsSummary(),
        api.getRecords(),
      ]);
      setStats(sData);
      setSummary(rData);
      setRecords(recData);

      // Compute Hourly Breakdown from inspection records
      computeHourlyBreakdown(recData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [datePreset, customDate]);

  const computeHourlyBreakdown = (dataList: InspectionRecord[]) => {
    const bucketsMap = new Map<number, HourlyBucket>();

    // Initialize business hours (07:00 to 18:00)
    for (let h = 7; h <= 18; h++) {
      const startH = h.toString().padStart(2, '0');
      const endH = (h + 1).toString().padStart(2, '0');
      bucketsMap.set(h, {
        hour: h,
        hourLabel: `${startH}:00 - ${endH}:00`,
        totalPeople: 0,
        maleCount: 0,
        femaleCount: 0,
        unclassifiedCount: 0,
        inspectionCount: 0,
        cameras: [],
      });
    }

    for (const record of dataList) {
      const p = record.payload || {};
      let h: number | null = null;

      if (p.observation_time_slot && typeof p.observation_time_slot === 'string') {
        const match = p.observation_time_slot.match(/^(\d{1,2}):/);
        if (match) {
          h = parseInt(match[1], 10);
        }
      }

      if (h === null && record.submitted_at) {
        const date = new Date(record.submitted_at);
        h = date.getHours();
      }

      if (h === null) continue;

      if (!bucketsMap.has(h)) {
        const startH = h.toString().padStart(2, '0');
        const endH = ((h + 1) % 24).toString().padStart(2, '0');
        bucketsMap.set(h, {
          hour: h,
          hourLabel: `${startH}:00 - ${endH}:00`,
          totalPeople: 0,
          maleCount: 0,
          femaleCount: 0,
          unclassifiedCount: 0,
          inspectionCount: 0,
          cameras: [],
        });
      }

      const bucket = bucketsMap.get(h)!;
      bucket.inspectionCount++;

      const camLabel = record.camera_name || record.camera_code || 'Kamera';
      if (!bucket.cameras.includes(camLabel)) {
        bucket.cameras.push(camLabel);
      }

      let m = 0;
      let f = 0;
      let tot = 0;

      if (typeof p.male_count === 'number') m = p.male_count;
      if (typeof p.female_count === 'number') f = p.female_count;
      if (typeof p.total_people === 'number') tot = p.total_people;

      if (tot === 0 && (m > 0 || f > 0)) {
        tot = m + f;
      }

      const unclass = Math.max(0, tot - (m + f));

      bucket.maleCount += m;
      bucket.femaleCount += f;
      bucket.unclassifiedCount += unclass;
      bucket.totalPeople += tot;
    }

    const sortedBuckets = Array.from(bucketsMap.values()).sort((a, b) => a.hour - b.hour);
    setHourlyStats(sortedBuckets);

    let peak: HourlyBucket | null = null;
    for (const b of sortedBuckets) {
      if (b.totalPeople > 0 && (!peak || b.totalPeople > peak.totalPeople)) {
        peak = b;
      }
    }
    setPeakHour(peak);
  };

  // Section 4 User filtering and sorting
  const rawUserStats = stats?.user_progress_stats || [];
  const activeInspectorsCount = rawUserStats.filter((u) => u.total_assigned > 0).length;

  const filteredUserStats = rawUserStats
    .filter((u) => {
      if (onlyActiveInspectors && u.total_assigned === 0) return false;
      if (searchUser.trim()) {
        const q = searchUser.toLowerCase();
        const matchName = u.user_name.toLowerCase().includes(q);
        const matchEmail = u.user_email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'ATTENTION') {
        if (a.total_assigned > 0 !== (b.total_assigned > 0)) {
          return a.total_assigned > 0 ? -1 : 1;
        }
        if (a.progress_pct !== b.progress_pct) {
          return a.progress_pct - b.progress_pct;
        }
        return b.total_assigned - a.total_assigned;
      } else if (sortBy === 'PROGRESS_ASC') {
        return a.progress_pct - b.progress_pct;
      } else if (sortBy === 'PROGRESS_DESC') {
        return b.progress_pct - a.progress_pct;
      } else {
        return a.user_name.localeCompare(b.user_name);
      }
    });

  useEffect(() => {
    setUserCurrentPage(1);
  }, [onlyActiveInspectors, searchUser, sortBy, datePreset, customDate]);

  const userTotalPages = Math.ceil(filteredUserStats.length / userPageSize) || 1;
  const paginatedUserStats = filteredUserStats.slice(
    (userCurrentPage - 1) * userPageSize,
    userCurrentPage * userPageSize
  );

  if (loading && !stats) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} className="spin-icon" color="#38bdf8" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Memuat analitik real-time...</p>
        </div>
      </div>
    );
  }

  const maxHourlyCount = Math.max(...hourlyStats.map((h) => h.totalPeople), 1);

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Dashboard Monitoring & Progress</h2>
          <p>Pemantauan real-time progress pengecekan, rekap hasil observasi, dan pemantauan jumlah orang per jam.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={16} /> Perbarui Data
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', marginBottom: '1.5rem', color: '#fb7185' }}>
          {error}
        </div>
      )}

      {/* DATE RANGE FILTER TOOLBAR */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CalendarDays size={15} color="#38bdf8" /> Rentang Data Dashboard:
          </span>
          {(['TODAY', 'YESTERDAY', 'ALL', 'CUSTOM'] as const).map((preset) => {
            const labels: Record<string, string> = {
              TODAY: 'Hari Ini',
              YESTERDAY: 'Kemarin',
              ALL: 'Semua Waktu',
              CUSTOM: 'Pilih Tanggal'
            };
            const isActive = datePreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setDatePreset(preset);
                  if (preset !== 'CUSTOM') setCustomDate('');
                }}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #0284c7' : '1px solid var(--border-subtle)',
                  background: isActive ? 'rgba(2, 132, 199, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#38bdf8' : 'var(--text-dim)',
                  transition: 'all 0.15s ease',
                }}
              >
                {labels[preset]}
              </button>
            );
          })}

          {datePreset === 'CUSTOM' && (
            <input
              type="date"
              className="form-input"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', width: '145px', borderColor: '#38bdf8' }}
            />
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Target Rekaman Terpilih:</span>
          <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
            {effectiveDate ? effectiveDate : 'Semua Rekaman'}
          </strong>
        </div>
      </div>

      {/* METRIK 1: TASK COMPLETION PROGRESS */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#38bdf8" />
            1. Progress Pengecekan Tugas (Task Completion)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            {effectiveDate ? `Dihitung untuk tanggal ${effectiveDate}` : 'Akumulasi seluruh waktu'}
          </span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>TOTAL TUGAS TERBIT</span>
              <div className="stat-icon" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>
                <ListTodo size={18} />
              </div>
            </div>
            <div className="stat-value">{stats?.total_tasks || 0}</div>
            <div className="stat-footer">Tugas kamera pada periode terpilih</div>
          </div>

          <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="stat-header">
              <span>SELESAI (DONE)</span>
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#34d399' }}>{stats?.done_tasks || 0}</div>
            <div className="stat-footer">Lolos validasi & tersimpan di database</div>
          </div>

          <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <div className="stat-header">
              <span>SEDANG DIKERJAKAN</span>
              <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <Clock size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats?.in_progress_tasks || 0}</div>
            <div className="stat-footer">Draft observasi sedang diisi</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>BELUM MULAI</span>
              <div className="stat-icon" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#94a3b8' }}>{stats?.not_started_tasks || 0}</div>
            <div className="stat-footer">Menunggu user membuka task</div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Tingkat Penyelesaian Keseluruhan Tim</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {stats?.done_tasks || 0} dari {stats?.total_tasks || 0} tugas kamera telah diselesaikan
              </p>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {stats?.overall_progress_pct || 0}%
            </div>
          </div>
          <div className="progress-container" style={{ height: '12px' }}>
            <div 
              className="progress-bar-fill" 
              style={{ width: `${stats?.overall_progress_pct || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* METRIK 2: HASIL OBSERVASI AGREGASI */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={18} color="#10b981" />
            2. Rekap Hasil Pengecekan Kamera (Inspection Results Payload)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Data terstruktur hasil observasi dari form dinamis yang diisi oleh user
          </span>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ background: 'linear-gradient(145deg, #121a2d, #14243d)' }}>
            <div className="stat-header">
              <span>TOTAL ORANG TERHITUNG</span>
              <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Users size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>
              {summary?.total_people_counted || 0}
            </div>
            <div className="stat-footer" style={{ display: 'flex', gap: '1rem', marginTop: '4px' }}>
              <span>Pria: <strong>{summary?.total_males_counted || 0}</strong></span>
              <span>Wanita: <strong>{summary?.total_females_counted || 0}</strong></span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>TEMUAN MASALAH / INSIDEN</span>
              <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: (summary?.total_issues_found || 0) > 0 ? '#fb7185' : '#34d399' }}>
              {summary?.total_issues_found || 0}
            </div>
            <div className="stat-footer">Kerusakan kamera atau anomali aktivitas</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>TOTAL REKAM INSPEKSI</span>
              <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                <FileCheck size={18} />
              </div>
            </div>
            <div className="stat-value">{summary?.total_inspections || 0}</div>
            <div className="stat-footer">Laporan observasi tersimpan di PostgreSQL</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>STATUS MASTER KAMERA</span>
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <Camera size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>
              {stats?.camera_status_summary?.online || 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>Online</span>
            </div>
            <div className="stat-footer">
              {stats?.camera_status_summary?.maintenance || 0} Maintenance · {stats?.camera_status_summary?.offline || 0} Offline
            </div>
          </div>
        </div>
      </div>

      {/* METRIK 3: PEMANTAUAN JUMLAH BERDASARKAN JAM (HOURLY MONITORING) */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={19} color="#38bdf8" />
              3. Pemantauan Jumlah Orang Berdasarkan Jam (Hourly Crowd Monitoring)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Distribusi jumlah orang yang teramati dari seluruh kamera berdasarkan jam input/observasi
            </p>
          </div>

          {peakHour && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                color: '#fbbf24',
              }}
            >
              <AlertTriangle size={15} color="#fbbf24" />
              <span>Jam Kepadatan Tertinggi (Peak Hour): <strong>{peakHour.hourLabel} WIB</strong> ({peakHour.totalPeople} orang)</span>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '0.75rem 1.25rem' }}>RENTANG JAM OBSERVASI</th>
                <th style={{ padding: '0.75rem 1rem' }}>TOTAL ORANG</th>
                <th style={{ padding: '0.75rem 1rem' }}>RINCIAN GENDER</th>
                <th style={{ padding: '0.75rem 1rem' }}>FREKUENSI INSPEKSI</th>
                <th style={{ padding: '0.75rem 1.25rem' }}>DISTRIBUSI KEPADATAN</th>
              </tr>
            </thead>
            <tbody>
              {hourlyStats.filter((h) => h.totalPeople > 0 || h.inspectionCount > 0).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Belum ada data observasi penghitungan orang yang tercatat di rentang jam hari ini.
                  </td>
                </tr>
              ) : (
                hourlyStats.filter((h) => h.totalPeople > 0 || h.inspectionCount > 0).map((h) => {
                  const pct = Math.round((h.totalPeople / maxHourlyCount) * 100);
                  const isPeak = peakHour && peakHour.hour === h.hour;

                  return (
                    <tr key={h.hour} style={{ borderBottom: '1px solid var(--border-subtle)', background: isPeak ? 'rgba(245, 158, 11, 0.04)' : undefined }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: isPeak ? '#fbbf24' : 'white' }}>
                        {h.hourLabel} WIB {isPeak && <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>Peak</span>}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, fontSize: '0.95rem', color: isPeak ? '#fbbf24' : 'var(--accent-cyan)' }}>
                        {h.totalPeople} Orang
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
                          <span style={{ color: '#818cf8' }}>Pria: <strong>{h.maleCount}</strong></span>
                          <span style={{ color: '#f43f5e' }}>Wanita: <strong>{h.femaleCount}</strong></span>
                          {h.unclassifiedCount > 0 && <span style={{ color: 'var(--text-dim)' }}>Samar: <strong>{h.unclassifiedCount}</strong></span>}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {h.inspectionCount} kali pengecekan ({h.cameras.join(', ') || '-'})
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="progress-container" style={{ flex: 1, height: '6px' }}>
                            <div 
                              className="progress-bar-fill" 
                              style={{ 
                                width: `${pct}%`,
                                background: isPeak ? 'linear-gradient(90deg, #f59e0b, #d97706)' : undefined 
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: '35px' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* METRIK 4: PROGRESS PER USER TABLE */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={19} color="#a855f7" />
              4. Progress Capaian per User (Inspector)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Pemantauan kinerja personil {effectiveDate ? `pada tanggal ${effectiveDate}` : 'akumulasi seluruh waktu'}.
            </p>
          </div>

          {/* Quick Filter Segmented Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setOnlyActiveInspectors(true)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: onlyActiveInspectors ? '#38bdf8' : 'transparent',
                color: onlyActiveInspectors ? '#0f172a' : 'var(--text-dim)',
                transition: 'all 0.15s ease',
              }}
            >
              Hanya Bertugas ({activeInspectorsCount})
            </button>
            <button
              type="button"
              onClick={() => setOnlyActiveInspectors(false)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: !onlyActiveInspectors ? '#38bdf8' : 'transparent',
                color: !onlyActiveInspectors ? '#0f172a' : 'var(--text-dim)',
                transition: 'all 0.15s ease',
              }}
            >
              Semua Personil ({rawUserStats.length})
            </button>
          </div>
        </div>

        {/* Section 4 Filter Toolbar */}
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '320px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.1rem', paddingRight: '2rem', fontSize: '0.8rem', padding: '0.38rem 0.6rem 0.38rem 2.1rem' }}
              placeholder="Cari nama atau email petugas..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
            {searchUser && (
              <button
                type="button"
                onClick={() => setSearchUser('')}
                style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Urutkan:</span>
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
            >
              <option value="ATTENTION">⚡ Perhatian Utama (Belum Selesai Teratas)</option>
              <option value="PROGRESS_ASC">📈 Progres Terendah (0% → 100%)</option>
              <option value="PROGRESS_DESC">🏆 Progres Tertinggi (100% → 0%)</option>
              <option value="NAME">🔤 Nama Petugas (A-Z)</option>
            </select>
          </div>
        </div>

        {/* User Progress Table */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>PETUGAS</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS TUGAS HARI INI</th>
                <th style={{ padding: '0.85rem 1rem' }}>TOTAL TUGAS</th>
                <th style={{ padding: '0.85rem 1rem' }}>SELESAI (DONE)</th>
                <th style={{ padding: '0.85rem 1rem' }}>DALAM PROGRES</th>
                <th style={{ padding: '0.85rem 1rem' }}>BELUM MULAI</th>
                <th style={{ padding: '0.85rem 1.25rem', width: '260px' }}>PROGRESS PENYELESAIAN</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUserStats.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    {onlyActiveInspectors 
                      ? 'Tidak ada personil yang memiliki jadwal penugasan pada tanggal ini. Klik "Semua Personil" untuk melihat seluruh tim.'
                      : 'Tidak ada personil yang sesuai dengan pencarian.'}
                  </td>
                </tr>
              ) : (
                paginatedUserStats.map((u) => {
                  const isAssigned = u.total_assigned > 0;
                  const isComplete = isAssigned && u.done_count === u.total_assigned;

                  return (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid var(--border-subtle)', background: !isAssigned ? 'rgba(255, 255, 255, 0.01)' : undefined }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'white' }}>{u.user_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{u.user_email}</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {isComplete ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={11} /> Tugas Tuntas
                          </span>
                        ) : isAssigned ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600, border: '1px solid rgba(56, 189, 248, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> Aktif Bertugas
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>
                            Tidak Ada Jadwal (Off)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontWeight: 600, color: isAssigned ? 'white' : 'var(--text-dim)' }}>{u.total_assigned}</span> Kamera
                      </td>
                      <td style={{ padding: '1rem', color: u.done_count > 0 ? '#34d399' : 'var(--text-dim)', fontWeight: 600 }}>
                        {u.done_count}
                      </td>
                      <td style={{ padding: '1rem', color: u.in_progress_count > 0 ? '#fbbf24' : 'var(--text-dim)', fontWeight: 600 }}>
                        {u.in_progress_count}
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-dim)' }}>
                        {u.not_started_count}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {isAssigned ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-muted)' }}>{u.done_count} / {u.total_assigned} Selesai</span>
                              <span style={{ fontWeight: 700, color: isComplete ? '#34d399' : (u.progress_pct === 0 ? '#fb7185' : 'var(--accent-cyan)') }}>
                                {u.progress_pct}%
                              </span>
                            </div>
                            <div className="progress-container" style={{ height: '8px' }}>
                              <div 
                                className="progress-bar-fill" 
                                style={{ 
                                  width: `${u.progress_pct}%`,
                                  background: isComplete 
                                    ? 'linear-gradient(90deg, #10b981, #059669)' 
                                    : (u.progress_pct === 0 ? '#fb7185' : undefined)
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* User Pagination */}
        <div style={{ marginTop: '0.85rem' }}>
          <Pagination
            currentPage={userCurrentPage}
            totalPages={userTotalPages}
            pageSize={userPageSize}
            totalItems={filteredUserStats.length}
            onPageChange={setUserCurrentPage}
            onPageSizeChange={(newSize) => {
              setUserPageSize(newSize);
              setUserCurrentPage(1);
            }}
            pageSizeOptions={[5, 10, 15, 25]}
          />
        </div>
      </div>
    </div>
  );
};
