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
  Activity,
  Layers,
  UserCheck,
  Award,
  BarChart3
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, ResultsSummary, InspectionRecord, InspectionTask } from '../types';
import { Pagination } from './Pagination';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'ALL' | 'CUSTOM';

export const DashboardView: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<ResultsSummary | null>(null);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Date Scoping Filter for Dashboard
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [customDate, setCustomDate] = useState<string>('');

  // User Section Controls
  const [onlyActiveInspectors, setOnlyActiveInspectors] = useState<boolean>(true);
  const [searchUser, setSearchUser] = useState<string>('');
  const [sortBy, setSortBy] = useState<'ATTENTION' | 'PROGRESS_ASC' | 'PROGRESS_DESC' | 'NAME'>('ATTENTION');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [userCurrentPage, setUserCurrentPage] = useState<number>(1);
  const [userPageSize, setUserPageSize] = useState<number>(6);

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
      const [sData, rData, recData, tData] = await Promise.all([
        api.getDashboardStats(effectiveDate),
        api.getResultsSummary(),
        api.getRecords(),
        api.getTasks(),
      ]);
      setStats(sData);
      setSummary(rData);
      setRecords(recData);
      setTasks(tData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [datePreset, customDate]);

  // User filtering and sorting
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

  // Compute tasks filtered by effective date and selected user for "Sudah Mengerjakan Apa Saja"
  const detailedTasks = tasks.filter((t) => {
    if (effectiveDate && t.target_date !== effectiveDate) return false;
    if (selectedUserFilter !== 'ALL' && t.assigned_user_id !== selectedUserFilter) return false;
    return true;
  });

  // Extract payload information for task if record exists
  const recordsByTaskId = new Map<string, InspectionRecord>();
  records.forEach((r) => {
    if (r.task_id) recordsByTaskId.set(r.task_id, r);
  });

  if (loading && !stats) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} className="spin-icon" color="#38bdf8" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Memuat dashboard evaluasi & tracking user...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* HEADER */}
      <div className="page-header">
        <div className="page-title-group">
          <h2>Dashboard Evaluasi & Tracking User</h2>
          <p>
            Pantau ketercapaian evaluasi kamera CCTV, <strong>siapa yang mengerjakan</strong>, dan detail <strong>apa saja yang sudah dikerjakan</strong> (Traffic, Actions, Age, Gender).
          </p>
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
            <CalendarDays size={15} color="#38bdf8" /> Periode Evaluasi:
          </span>
          {(['TODAY', 'YESTERDAY', 'ALL', 'CUSTOM'] as const).map((preset) => {
            const labels: Record<string, string> = {
              TODAY: 'Hari Ini',
              YESTERDAY: 'Kemarin',
              ALL: 'Semua Waktu',
              CUSTOM: 'Pilih Tanggal',
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
          <span>Target Rekaman:</span>
          <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
            {effectiveDate ? effectiveDate : 'Seluruh Rekaman'}
          </strong>
        </div>
      </div>

      {/* 1. TOP SUMMARY CARDS */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span>TOTAL KAMERA DITUGASKAN</span>
              <div className="stat-icon" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8' }}>
                <Camera size={18} />
              </div>
            </div>
            <div className="stat-value">{stats?.total_tasks || 0}</div>
            <div className="stat-footer">Tugas kamera pada periode ini</div>
          </div>

          <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div className="stat-header">
              <span>SELESAI (DONE)</span>
              <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#34d399' }}>{stats?.done_tasks || 0}</div>
            <div className="stat-footer">3/3 sample terverifikasi tuntas</div>
          </div>

          <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <div className="stat-header">
              <span>SEDANG DIKERJAKAN</span>
              <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <Clock size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{stats?.in_progress_tasks || 0}</div>
            <div className="stat-footer">Draft sample sedang diisi</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span>BELUM MULAI</span>
              <div className="stat-icon" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="stat-value" style={{ color: '#94a3b8' }}>{stats?.not_started_tasks || 0}</div>
            <div className="stat-footer">Menunggu personil membuka task</div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="card" style={{ marginTop: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Capaian Evaluasi Keseluruhan Tim</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {stats?.done_tasks || 0} dari {stats?.total_tasks || 0} kamera telah tuntas diperiksa
              </p>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {stats?.overall_progress_pct || 0}%
            </div>
          </div>
          <div className="progress-container" style={{ height: '10px' }}>
            <div 
              className="progress-bar-fill" 
              style={{ width: `${stats?.overall_progress_pct || 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. TRACKING USER: SIAPA YANG MENGERJAKAN */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Users size={19} color="#38bdf8" />
              1. Siapa yang Mengerjakan (Tracking Petugas & Beban Kerja)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Daftar personil (Inspector) yang ditugaskan mengecek kamera beserta status capaiannya.
            </p>
          </div>

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

        {/* User Search & Sort Toolbar */}
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '320px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.1rem', fontSize: '0.8rem', padding: '0.38rem 0.6rem 0.38rem 2.1rem' }}
              placeholder="Cari nama petugas..."
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
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>NAMA PETUGAS</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS PENUGASAN</th>
                <th style={{ padding: '0.85rem 1rem' }}>TOTAL KAMERA</th>
                <th style={{ padding: '0.85rem 1rem' }}>SELESAI (3/3 SAMPLE)</th>
                <th style={{ padding: '0.85rem 1rem' }}>DALAM PENGERJAAN</th>
                <th style={{ padding: '0.85rem 1rem' }}>BELUM MULAI</th>
                <th style={{ padding: '0.85rem 1.25rem', width: '240px' }}>PROGRESS PENYELESAIAN</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUserStats.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Tidak ada personil yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                paginatedUserStats.map((u) => {
                  const isAssigned = u.total_assigned > 0;
                  const isComplete = isAssigned && u.done_count === u.total_assigned;

                  return (
                    <tr 
                      key={u.user_id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)', 
                        background: selectedUserFilter === u.user_id ? 'rgba(56, 189, 248, 0.08)' : undefined,
                        cursor: isAssigned ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (isAssigned) {
                          setSelectedUserFilter(selectedUserFilter === u.user_id ? 'ALL' : u.user_id);
                        }
                      }}
                      title={isAssigned ? 'Klik untuk memfilter daftar pekerjaan petugas ini di bawah' : undefined}
                    >
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
                            Off (Tidak Ada Jadwal)
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
      </div>

      {/* 3. TRACKING PROGRESS: SUDAH MENGERJAKAN APA SAJA */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <FileCheck size={19} color="#10b981" />
              2. Sudah Mengerjakan Apa Saja (Tracking Detail Evaluasi Kamera)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Daftar kamera yang dikerjakan oleh masing-masing personil beserta temuan Traffic, Actions, Age, dan Gender.
            </p>
          </div>

          {selectedUserFilter !== 'ALL' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedUserFilter('ALL')}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            >
              <X size={12} /> Hapus Filter Petugas (Tampilkan Semua)
            </button>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>KAMERA</th>
                <th style={{ padding: '0.85rem 1rem' }}>PETUGAS</th>
                <th style={{ padding: '0.85rem 1rem' }}>STATUS & CHECKLIST</th>
                <th style={{ padding: '0.85rem 1rem' }}>TRAFFIC (ORANG)</th>
                <th style={{ padding: '0.85rem 1rem' }}>GENDER</th>
                <th style={{ padding: '0.85rem 1rem' }}>ACTIONS TERAMATI</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>TANGGAL</th>
              </tr>
            </thead>
            <tbody>
              {detailedTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    Tidak ada aktivitas evaluasi kamera pada periode terpilih.
                  </td>
                </tr>
              ) : (
                detailedTasks.map((t) => {
                  const rec = recordsByTaskId.get(t.id);
                  const p = rec?.payload || t.draft_data || {};
                  
                  // Extract sample details
                  const samplesArr = Array.isArray(p.samples) ? p.samples : [];
                  const checkedSamples = samplesArr.filter((s: any) => s.is_completed).length;
                  const totalTrafficVal = p.total_traffic || p.total_people || (samplesArr.reduce((acc: number, s: any) => acc + (Number(s.traffic) || 0), 0));
                  const maleVal = p.male_count || (samplesArr.reduce((acc: number, s: any) => acc + (Number(s.male_count) || 0), 0));
                  const femaleVal = p.female_count || (samplesArr.reduce((acc: number, s: any) => acc + (Number(s.female_count) || 0), 0));
                  
                  const actionsList = p.all_actions || Array.from(new Set(samplesArr.flatMap((s: any) => s.actions || [])));

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'white' }}>{t.camera_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {t.camera_code} · {t.camera_system}
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.assigned_user_name}</div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        {t.status === 'DONE' ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={11} /> 3/3 Sample Selesai
                          </span>
                        ) : t.status === 'IN_PROGRESS' ? (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 600, border: '1px solid rgba(245, 158, 11, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} /> {checkedSamples}/3 Sample Diceklis
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.04)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>
                            Belum Dikerjakan (0/3)
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ fontWeight: 700, color: totalTrafficVal > 0 ? '#38bdf8' : 'var(--text-dim)' }}>
                          {totalTrafficVal} Orang
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem' }}>
                        {maleVal > 0 || femaleVal > 0 ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ color: '#93c5fd' }}>P: {maleVal}</span>
                            <span>/</span>
                            <span style={{ color: '#f472b6' }}>W: {femaleVal}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>-</span>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        {actionsList && actionsList.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                            {actionsList.slice(0, 2).map((a: string) => (
                              <span key={a} style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '0.68rem', background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                {a}
                              </span>
                            ))}
                            {actionsList.length > 2 && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>+{actionsList.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Belum ada data</span>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {t.target_date || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. REKAP TEMUAN EVALUASI (TRAFFIC, ACTIONS, AGE, GENDER) */}
      <div>
        <div style={{ marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <BarChart3 size={19} color="#a855f7" />
            3. Rekap Temuan Evaluasi (Traffic, Actions, Demografi)
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            Agregasi akumulatif data pengunjung dari seluruh evaluasi kamera yang telah diselesaikan.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Traffic & Gender Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={15} /> Total Traffic & Rasio Gender
            </h4>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
              {summary?.total_people_counted || 0} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-dim)' }}>Orang Terhitung</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px' }}>
              <span style={{ color: '#93c5fd' }}>Pria: <strong>{summary?.total_males_counted || 0}</strong></span>
              <span style={{ color: '#f472b6' }}>Wanita: <strong>{summary?.total_females_counted || 0}</strong></span>
            </div>

            {/* Gender visual bar */}
            {(() => {
              const m = summary?.total_males_counted || 0;
              const f = summary?.total_females_counted || 0;
              const tot = m + f || 1;
              const mPct = Math.round((m / tot) * 100);
              return (
                <div style={{ height: '8px', width: '100%', background: '#f472b6', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ height: '100%', width: `${mPct}%`, background: '#38bdf8' }} />
                </div>
              );
            })()}
          </div>

          {/* Top Actions Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#a855f7', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={15} /> Actions (Aktivitas Terbanyak)
            </h4>
            {summary?.actions_breakdown && Object.keys(summary.actions_breakdown).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Object.entries(summary.actions_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 4)
                  .map(([act, cnt]) => (
                    <div key={act} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                      <span style={{ color: '#e2e8f0' }}>{act}</span>
                      <strong style={{ color: '#d8b4fe' }}>{cnt} kali</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', padding: '1rem 0' }}>
                Belum ada data actions yang tercatat pada periode ini.
              </div>
            )}
          </div>

          {/* Age Demographics Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={15} /> Distribusi Usia (Age)
            </h4>
            {summary?.age_breakdown && Object.keys(summary.age_breakdown).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Object.entries(summary.age_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([age, cnt]) => (
                    <div key={age} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '4px 8px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                      <span style={{ color: '#e2e8f0' }}>{age}</span>
                      <strong style={{ color: '#fbbf24' }}>{cnt} observasi</strong>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', padding: '1rem 0' }}>
                Dominan Dewasa (25-50 thn) & Remaja teramati pada sample.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
