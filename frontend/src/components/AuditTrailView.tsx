import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  User, 
  Camera, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  LogIn, 
  X, 
  Eye, 
  Copy, 
  Check,
  CheckSquare
} from 'lucide-react';
import { api } from '../services/api';
import { AuditLog, AuditStats } from '../types';
import { Pagination } from './Pagination';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7_DAYS' | '30_DAYS'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Selected Log for JSON Drawer/Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAuditLogs();
    loadAuditStats();
  }, [currentPage, pageSize, actionFilter, categoryFilter, dateFilter]);

  // Handle Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      loadAuditLogs();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const getDateRange = (): { start_date?: string; end_date?: string } => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (dateFilter === 'TODAY') {
      return { start_date: todayStr, end_date: todayStr };
    }
    if (dateFilter === '7_DAYS') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start_date: past.toISOString().slice(0, 10), end_date: todayStr };
    }
    if (dateFilter === '30_DAYS') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start_date: past.toISOString().slice(0, 10), end_date: todayStr };
    }
    return {};
  };

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const { start_date, end_date } = getDateRange();
      const res = await api.getAuditLogs({
        action: actionFilter,
        target_type: categoryFilter,
        search: search.trim() || undefined,
        start_date,
        end_date,
        page: currentPage,
        page_size: pageSize,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditStats = async () => {
    try {
      const res = await api.getAuditStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to load audit stats:', err);
    }
  };

  const handleExportCSV = async () => {
    try {
      await api.downloadAuditLogsCSV({
        action: actionFilter,
        target_type: categoryFilter,
        search: search.trim() || undefined,
      });
    } catch (err: any) {
      alert(err.message || 'Gagal mengunduh CSV audit trail');
    }
  };

  const handleCopyJSON = () => {
    if (!selectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(selectedLog.details, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN':
      case 'DEMO_LOGIN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}>
            <LogIn size={11} /> {action}
          </span>
        );
      case 'CREATE_CAMERA':
      case 'UPDATE_CAMERA':
      case 'DELETE_CAMERA':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: action === 'DELETE_CAMERA' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(14, 165, 233, 0.15)', border: `1px solid ${action === 'DELETE_CAMERA' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(14, 165, 233, 0.4)'}`, color: action === 'DELETE_CAMERA' ? '#fb7185' : '#38bdf8' }}>
            <Camera size={11} /> {action}
          </span>
        );
      case 'ASSIGN_TASK':
      case 'BATCH_ASSIGN_TASK':
      case 'REASSIGN_TASK':
      case 'DELETE_TASK':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: action === 'DELETE_TASK' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(139, 92, 246, 0.15)', border: `1px solid ${action === 'DELETE_TASK' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`, color: action === 'DELETE_TASK' ? '#fb7185' : '#c084fc' }}>
            <CheckSquare size={11} /> {action}
          </span>
        );
      case 'SUBMIT_INSPECTION':
      case 'INSPECTION_SUBMIT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#34d399' }}>
            <CheckCircle2 size={11} /> SUBMIT_INSPECTION
          </span>
        );
      case 'APPROVE_INSPECTION':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.45)', color: '#10b981' }}>
            <Check size={11} /> APPROVE_INSPECTION
          </span>
        );
      case 'REQUEST_REVISION':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.18)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}>
            <AlertTriangle size={11} /> REQUEST_REVISION
          </span>
        );
      case 'CREATE_USER':
      case 'UPDATE_USER':
      case 'DELETE_USER':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: action === 'DELETE_USER' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(168, 85, 247, 0.15)', border: `1px solid ${action === 'DELETE_USER' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`, color: action === 'DELETE_USER' ? '#fb7185' : '#c084fc' }}>
            <User size={11} /> {action}
          </span>
        );
      case 'CREATE_TEMPLATE':
      case 'UPDATE_TEMPLATE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.4)', color: '#f472b6' }}>
            <Layers size={11} /> {action}
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: 700, background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)' }}>
            <Activity size={11} /> {action}
          </span>
        );
    }
  };

  const formatSummary = (log: AuditLog) => {
    if (!log.details) return '-';
    const d = log.details;
    switch (log.action) {
      case 'LOGIN':
        return `Login berhasil (IP: ${d.ip || 'Local'}, Role: ${d.role || '-'})`;
      case 'DEMO_LOGIN':
        return `Demo switch ke role ${d.role || '-'}`;
      case 'CREATE_CAMERA':
        return `Menambahkan kamera [${d.code}] ${d.name} (${d.system} - Ch.${d.channel_no})`;
      case 'UPDATE_CAMERA':
        return `Memperbarui kamera [${d.code}] ${d.name} (${d.status})`;
      case 'DELETE_CAMERA':
        return `Menghapus titik kamera ID: ${d.camera_id || log.target_id}`;
      case 'ASSIGN_TASK':
        return `Menjadwalkan observasi kamera pada ${d.target_date || '-'} (${d.target_time_slot || 'Semua Jam'})`;
      case 'BATCH_ASSIGN_TASK':
        return `Menjadwalkan serentak ${d.total_created || 0} slot observasi untuk ${d.camera_count || 0} kamera pada ${d.target_date || '-'}`;
      case 'REASSIGN_TASK':
        return `Mengalihkan penugasan tugas ${d.task_id} ke petugas lain`;
      case 'DELETE_TASK':
        return `Menghapus tugas observasi ID: ${d.task_id || log.target_id}`;
      case 'SUBMIT_INSPECTION':
      case 'INSPECTION_SUBMIT':
        return `Petugas mengirim hasil observasi kamera ${d.camera_name || ''} (${d.target_date || ''} ${d.target_time_slot || ''})`;
      case 'APPROVE_INSPECTION':
        return `Supervisor MENYETUJUI hasil observasi (Catatan: ${d.notes || 'Sesuai standar'})`;
      case 'REQUEST_REVISION':
        return `Supervisor MEMINTA REVISI pengerjaan (Catatan: ${d.notes || 'Periksa ulang'})`;
      case 'CREATE_USER':
        return `Membuat akun pengguna baru: ${d.name} (${d.email}) sebagai [${d.role}]`;
      case 'UPDATE_USER':
        return `Memperbarui data pengguna: ${d.name} (${d.role})`;
      case 'DELETE_USER':
        return `Menghapus akun pengguna ID: ${d.deleted_user_id || log.target_id}`;
      case 'CREATE_TEMPLATE':
        return `Membuat template formulir: ${d.name} [${d.code}] v${d.version || 1}`;
      case 'UPDATE_TEMPLATE':
        return `Menerbitkan versi v${d.version_number} untuk template ${d.template_id}`;
      default:
        return JSON.stringify(d).slice(0, 60);
    }
  };

  return (
    <div>
      {/* STATS OVERVIEW CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #0ea5e9' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="#38bdf8" /> TOTAL JEJAK AUDIT
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#ffffff' }}>
            {stats ? stats.total_logs.toLocaleString() : total.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>Seluruh riwayat aksi terekam</div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} color="#34d399" /> AKTIVITAS HARI INI
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#34d399' }}>
            {stats ? stats.today_logs.toLocaleString() : 0}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>Aksi pada tanggal hari ini</div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#c084fc" /> KATEGORI TERBANYAK
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase' }}>
            {stats && stats.category_breakdown ? Object.keys(stats.category_breakdown)[0] || 'TASK' : 'TASK'}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#c084fc', marginTop: '4px' }}>
            {stats && stats.category_breakdown ? Object.values(stats.category_breakdown)[0] || 0 : 0} aktivitas
          </div>
        </div>

        <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#10b981" /> STATUS MONITORING
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.2rem', fontWeight: 800, color: '#34d399' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            100% AKTIF
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>Jejak audit otomatis aktif</div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Date Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Clock size={14} color="#38bdf8" /> RENTANG WAKTU:
            </span>
            <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              {[
                { key: 'ALL', label: 'Semua' },
                { key: 'TODAY', label: 'Hari Ini' },
                { key: '7_DAYS', label: '7 Hari Terakhir' },
                { key: '30_DAYS', label: '30 Hari Terakhir' },
              ].map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => { setDateFilter(d.key as any); setCurrentPage(1); }}
                  style={{
                    background: dateFilter === d.key ? 'var(--primary)' : 'transparent',
                    color: dateFilter === d.key ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { loadAuditLogs(); loadAuditStats(); }} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Segarkan
            </button>
            <button className="btn btn-primary" onClick={handleExportCSV} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
              <Download size={14} /> Unduh CSV Log
            </button>
          </div>
        </div>

        {/* Row 2: Search & Dropdowns */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, email, ID, atau kata kunci aktivitas..."
                style={{ padding: '0.45rem 2rem 0.45rem 2.2rem', fontSize: '0.82rem', width: '100%' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#818cf8" />
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', width: 'auto' }}
              >
                <option value="ALL">Semua Kategori</option>
                <option value="AUTH">🔐 Autentikasi (AUTH)</option>
                <option value="CAMERA">📹 Master Kamera (CAMERA)</option>
                <option value="TASK">📋 Penugasan Jadwal (TASK)</option>
                <option value="RECORD">✍️ Observasi & Review (RECORD)</option>
                <option value="USER">👥 Manajemen User (USER)</option>
                <option value="TEMPLATE">📄 Template Form (TEMPLATE)</option>
              </select>
            </div>

            {/* Action Dropdown */}
            <select
              className="form-select"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', width: 'auto' }}
            >
              <option value="ALL">Semua Jenis Aksi</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE_CAMERA">CREATE_CAMERA</option>
              <option value="UPDATE_CAMERA">UPDATE_CAMERA</option>
              <option value="DELETE_CAMERA">DELETE_CAMERA</option>
              <option value="ASSIGN_TASK">ASSIGN_TASK</option>
              <option value="BATCH_ASSIGN_TASK">BATCH_ASSIGN_TASK</option>
              <option value="REASSIGN_TASK">REASSIGN_TASK</option>
              <option value="DELETE_TASK">DELETE_TASK</option>
              <option value="SUBMIT_INSPECTION">SUBMIT_INSPECTION</option>
              <option value="APPROVE_INSPECTION">APPROVE_INSPECTION</option>
              <option value="REQUEST_REVISION">REQUEST_REVISION</option>
              <option value="CREATE_USER">CREATE_USER</option>
              <option value="UPDATE_USER">UPDATE_USER</option>
              <option value="DELETE_USER">DELETE_USER</option>
              <option value="CREATE_TEMPLATE">CREATE_TEMPLATE</option>
              <option value="UPDATE_TEMPLATE">UPDATE_TEMPLATE</option>
            </select>
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
            Menampilkan <strong style={{ color: '#ffffff' }}>{logs.length}</strong> dari <strong>{total}</strong> log aktivitas
          </span>
        </div>
      </div>

      {/* AUDIT LOGS TABLE */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
          Memuat jejak audit sistem...
        </div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <Activity size={40} color="var(--text-dim)" style={{ margin: '0 auto 0.75rem' }} />
          <h3>Tidak ada log aktivitas</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Belum ada log yang sesuai dengan filter atau pencarian Anda.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem', width: '170px' }}>WAKTU (WIB)</th>
                  <th style={{ padding: '0.85rem 1rem', width: '220px' }}>PENGGUNA</th>
                  <th style={{ padding: '0.85rem 1rem', width: '170px' }}>AKSI</th>
                  <th style={{ padding: '0.85rem 1rem', width: '110px' }}>KATEGORI</th>
                  <th style={{ padding: '0.85rem 1rem' }}>RINGKASAN AKTIVITAS</th>
                  <th style={{ padding: '0.85rem 1rem', width: '100px', textAlign: 'right' }}>DETAIL</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.012)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.012)')}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>
                          {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          {new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                        </span>
                      </div>
                    </td>

                    {/* User */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: log.user_role === 'admin' ? 'linear-gradient(135deg, #a855f7, #6366f1)' : log.user_role === 'supervisor' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #0284c7, #38bdf8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            flexShrink: 0,
                          }}
                        >
                          {(log.user_name || 'U').substring(0, 1).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {log.user_name || 'Sistem / Anonim'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {log.user_email || log.user_id || '-'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getActionBadge(log.action)}
                    </td>

                    {/* Category */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: '#a5b4fc',
                        }}
                      >
                        {log.target_type}
                      </span>
                    </td>

                    {/* Activity Summary */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                        {formatSummary(log)}
                      </div>
                      {log.target_id && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          Target ID: {log.target_id}
                        </div>
                      )}
                    </td>

                    {/* Detail Button */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)')}
                        title="Lihat Detail Payload JSON"
                      >
                        <Eye size={12} /> JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {!loading && total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(total / pageSize) || 1}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}

      {/* JSON DETAILS MODAL */}
      {selectedLog && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  Detail Log Audit: {selectedLog.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Summary attributes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Aksi:</span> <strong>{selectedLog.action}</strong>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Kategori:</span> <strong>{selectedLog.target_type}</strong>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Pelaku:</span> <strong>{selectedLog.user_name || selectedLog.user_id || 'Sistem'}</strong>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Waktu:</span> <strong>{new Date(selectedLog.created_at).toLocaleString('id-ID')} WIB</strong>
                </div>
              </div>

              {/* JSON code box */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>PAYLOAD DATA (JSON):</span>
                  <button
                    type="button"
                    onClick={handleCopyJSON}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copied ? '#34d399' : '#38bdf8',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Tersalin!' : 'Salin JSON'}
                  </button>
                </div>
                <pre
                  style={{
                    background: '#070b14',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '1rem',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    color: '#38bdf8',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
