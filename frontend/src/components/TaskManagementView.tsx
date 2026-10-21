import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Users, 
  Camera, 
  Calendar, 
  RefreshCw, 
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Zap,
  Check,
  CalendarDays,
  Layers,
  Server,
  Search,
  X,
  EyeOff
} from 'lucide-react';
import { api } from '../services/api';
import { InspectionTask, Camera as CameraType, User, FormTemplate } from '../types';
import { Pagination } from './Pagination';

const STANDARD_TIME_SLOTS = [
  '07:00 - 08:00 WIB',
  '08:00 - 09:00 WIB',
  '09:00 - 10:00 WIB',
  '10:00 - 11:00 WIB',
  '11:00 - 12:00 WIB',
  '12:00 - 13:00 WIB',
  '13:00 - 14:00 WIB',
  '14:00 - 15:00 WIB',
  '15:00 - 16:00 WIB',
  '16:00 - 17:00 WIB',
  '17:00 - 18:00 WIB',
];

interface TaskManagementViewProps {
  initialSearch?: string;
}

export const TaskManagementView: React.FC<TaskManagementViewProps> = ({
  initialSearch,
}) => {
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [inspectors, setInspectors] = useState<User[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Batch Assignment Modal States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedCamIds, setSelectedCamIds] = useState<string[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  
  // New: Scheduled Date and Time Slots
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([
    '08:00 - 09:00 WIB',
    '12:00 - 13:00 WIB',
    '17:00 - 18:00 WIB',
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Pagination states for task table
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>(initialSearch || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [modalSystemFilter, setModalSystemFilter] = useState<'ALL' | 'InaAI' | 'AEON'>('ALL');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [tData, cData, uData, tmplData] = await Promise.all([
        api.getTasks(),
        api.getCameras(),
        api.getUsers('inspector'),
        api.getFormTemplates(),
      ]);
      setTasks(tData);
      setCameras(cData);
      setInspectors(uData);
      setTemplates(tmplData);

      if (uData.length > 0) setAssignedUserId(uData[0].id);
      if (tmplData.length > 0) {
        setSelectedTemplateId(tmplData[0].id);
        loadTemplateVersions(tmplData[0].id);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memuat data penugasan', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateVersions = async (templateId: string) => {
    try {
      const full = await api.getFormTemplate(templateId);
      if (full.versions && full.versions.length > 0) {
        setSelectedVersionId(full.versions[0].id);
      }
    } catch {
      // ignore
    }
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplateId);
  const isPeopleCounting = currentTemplate?.code === 'FORM-PEOPLE' || 
                           currentTemplate?.name.toLowerCase().includes('people') || 
                           currentTemplate?.name.toLowerCase().includes('orang');

  const toggleSelectCamera = (id: string) => {
    if (selectedCamIds.includes(id)) {
      setSelectedCamIds(selectedCamIds.filter(c => c !== id));
    } else {
      setSelectedCamIds([...selectedCamIds, id]);
    }
  };

  const selectAllCameras = () => {
    if (selectedCamIds.length === cameras.length) {
      setSelectedCamIds([]);
    } else {
      setSelectedCamIds(cameras.map(c => c.id));
    }
  };

  const toggleTimeSlot = (slot: string) => {
    if (selectedTimeSlots.includes(slot)) {
      setSelectedTimeSlots(selectedTimeSlots.filter(s => s !== slot));
    } else {
      setSelectedTimeSlots([...selectedTimeSlots, slot]);
    }
  };

  // Slot Presets
  const setPresetPeak = () => {
    setSelectedTimeSlots(['08:00 - 09:00 WIB', '12:00 - 13:00 WIB', '17:00 - 18:00 WIB']);
  };

  const setPresetEvery2Hours = () => {
    setSelectedTimeSlots(['08:00 - 09:00 WIB', '10:00 - 11:00 WIB', '12:00 - 13:00 WIB', '14:00 - 15:00 WIB', '16:00 - 17:00 WIB']);
  };

  const setPresetAllSlots = () => {
    setSelectedTimeSlots([...STANDARD_TIME_SLOTS]);
  };

  const clearSlots = () => {
    setSelectedTimeSlots([]);
  };

  const slotsToApply = isPeopleCounting ? selectedTimeSlots : [];
  const totalTasksWillCreate = selectedCamIds.length * (slotsToApply.length > 0 ? slotsToApply.length : 1);

  const handleCreateBatch = async () => {
    if (selectedCamIds.length === 0) {
      alert('Pilih minimal satu kamera untuk ditugaskan!');
      return;
    }
    if (!assignedUserId || !selectedVersionId) {
      alert('Pilih petugas dan versi form template!');
      return;
    }
    if (isPeopleCounting && selectedTimeSlots.length === 0) {
      alert('Pilih minimal satu slot jam pengamatan untuk formulir Penghitungan Orang!');
      return;
    }

    try {
      setSubmitting(true);
      await api.batchCreateTasks({
        camera_ids: selectedCamIds,
        assigned_user_id: assignedUserId,
        template_version_id: selectedVersionId,
        target_date: targetDate,
        target_time_slots: slotsToApply,
      });
      setMessage({ 
        text: `Sukses! ${totalTasksWillCreate} tugas inspeksi terjadwal berhasil didistribusikan untuk tanggal ${targetDate}!`, 
        type: 'success' 
      });
      setShowBatchModal(false);
      setSelectedCamIds([]);
      await loadAllData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menugaskan tugas', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setShowBatchModal(false);
  };

  // Date computation helpers
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const getWeekRange = () => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const toStr = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayStr}`;
    };
    return { start: toStr(monday), end: toStr(sunday) };
  };

  const { start: weekStartStr, end: weekEndStr } = getWeekRange();
  const uniqueDates = Array.from(new Set(tasks.map((t) => t.target_date || '').filter((d) => d !== ''))).sort().reverse();

  // Filter tasks based on date preset, custom date, status, and search
  const filteredTasks = tasks.filter((t) => {
    // Date Preset Filter
    if (datePreset === 'TODAY') {
      if (t.target_date !== todayStr) return false;
    } else if (datePreset === 'THIS_WEEK') {
      if (!t.target_date || t.target_date < weekStartStr || t.target_date > weekEndStr) return false;
    } else if (datePreset === 'THIS_MONTH') {
      if (!t.target_date || !t.target_date.startsWith(currentMonthPrefix)) return false;
    } else if (datePreset === 'CUSTOM') {
      if (customDate && t.target_date !== customDate) return false;
    }

    // Status Filter
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

    // Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCam = t.camera_name?.toLowerCase().includes(q) || t.camera_code?.toLowerCase().includes(q);
      const matchInsp = t.assigned_user_name?.toLowerCase().includes(q);
      const matchSlot = t.target_time_slot?.toLowerCase().includes(q);
      if (!matchCam && !matchInsp && !matchSlot) return false;
    }
    return true;
  });

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [datePreset, customDate, statusFilter, search]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isFiltering = datePreset !== 'ALL' || customDate !== '' || statusFilter !== 'ALL' || search.trim() !== '';

  const resetFilters = () => {
    setDatePreset('ALL');
    setCustomDate('');
    setStatusFilter('ALL');
    setSearch('');
    setCurrentPage(1);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Distribusi & Penugasan Tugas Terjadwal</h2>
          <p>Tugaskan kamera, tanggal rekaman, dan slot jam pengamatan kepada petugas lapangan (Inspector).</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadAllData}>
            <RefreshCw size={16} /> Perbarui
          </button>
          <button className="btn btn-primary" onClick={() => setShowBatchModal(true)}>
            <Plus size={16} /> Tugaskan Inspeksi (Terjadwal)
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: message.type === 'success' ? '#86efac' : '#fca5a5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* REFINED FILTER TOOLBAR WITH DATE PRESETS */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        {/* Row 1: Date Presets & Custom Date Picker */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <CalendarDays size={14} color="var(--accent-cyan)" /> TANGGAL TARGET:
            </span>
            <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('ALL');
                  setCustomDate('');
                }}
                style={{
                  background: datePreset === 'ALL' ? 'var(--primary)' : 'transparent',
                  color: datePreset === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Semua ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('TODAY');
                  setCustomDate('');
                }}
                style={{
                  background: datePreset === 'TODAY' ? 'var(--accent-cyan)' : 'transparent',
                  color: datePreset === 'TODAY' ? '#000000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('THIS_WEEK');
                  setCustomDate('');
                }}
                style={{
                  background: datePreset === 'THIS_WEEK' ? '#0ea5e9' : 'transparent',
                  color: datePreset === 'THIS_WEEK' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Minggu Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('THIS_MONTH');
                  setCustomDate('');
                }}
                style={{
                  background: datePreset === 'THIS_MONTH' ? '#8b5cf6' : 'transparent',
                  color: datePreset === 'THIS_MONTH' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('CUSTOM')}
                style={{
                  background: datePreset === 'CUSTOM' ? '#f59e0b' : 'transparent',
                  color: datePreset === 'CUSTOM' ? '#000000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Pilih Tanggal...
              </button>
            </div>
          </div>

          {/* Custom Date Input or Dropdown when CUSTOM is active */}
          {datePreset === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.08)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <input
                type="date"
                className="form-input"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
              />
              {uniqueDates.length > 0 && (
                <select
                  className="form-select"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
                >
                  <option value="">Dari Riwayat Tanggal...</option>
                  {uniqueDates.map((d) => (
                    <option key={d} value={d}>
                      {d} ({tasks.filter((t) => t.target_date === d).length} tugas)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Status Filter, Live Search & Reset */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
            {/* Status Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#818cf8" />
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '0.42rem 0.75rem', fontSize: '0.82rem', width: 'auto', minWidth: '160px' }}
              >
                <option value="ALL">Semua Status Tugas</option>
                <option value="DONE">✓ Selesai (Done)</option>
                <option value="IN_PROGRESS">⏳ Draft In Progress</option>
                <option value="NOT_STARTED">⚠️ Belum Mulai</option>
                <option value="REVISION_NEEDED">🔄 Revisi Diminta</option>
              </select>
            </div>

            {/* Live Search Input */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kamera, petugas, slot jam..."
                style={{ padding: '0.42rem 2rem 0.42rem 2.2rem', fontSize: '0.82rem', width: '100%' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Results Counter & Reset Filter Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Menampilkan <strong style={{ color: '#ffffff' }}>{filteredTasks.length}</strong> dari{' '}
              <strong>{tasks.length}</strong> total tugas
            </span>

            {isFiltering && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetFilters}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
              >
                <X size={13} /> Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TASK LIST TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
              <th style={{ padding: '0.85rem 1.25rem' }}>ID TUGAS</th>
              <th style={{ padding: '0.85rem 1rem' }}>KAMERA & NVR</th>
              <th style={{ padding: '0.85rem 1rem' }}>PETUGAS DITUGASKAN</th>
              <th style={{ padding: '0.85rem 1rem' }}>TANGGAL TARGET</th>
              <th style={{ padding: '0.85rem 1rem' }}>SLOT JAM PENGAMATAN</th>
              <th style={{ padding: '0.85rem 1rem' }}>TEMPLATE FORM</th>
              <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>WAKTU TERBIT</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                  Tidak ada tugas yang sesuai dengan filter tanggal yang dipilih.
                </td>
              </tr>
            ) : (
              paginatedTasks.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                    {t.id}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: '3px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: t.camera_system === 'InaAI' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        color: t.camera_system === 'InaAI' ? '#38bdf8' : '#c084fc',
                        border: `1px solid ${t.camera_system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                      }}>
                        {t.camera_system || 'InaAI'}
                      </span>
                      {t.camera_nvr && (
                        <span style={{ fontSize: '0.72rem', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                          {t.camera_nvr} (Ch {t.camera_channel_no || 1})
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, color: 'white' }}>{t.camera_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{t.camera_code}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600 }}>{t.assigned_user_name}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      background: 'rgba(56, 189, 248, 0.1)', 
                      color: '#38bdf8', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.78rem', 
                      fontWeight: 600 
                    }}>
                      <Calendar size={12} /> {t.target_date || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {t.target_time_slot ? (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        background: 'rgba(99, 102, 241, 0.15)', 
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#a5b4fc', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.78rem', 
                        fontWeight: 600 
                      }}>
                        <Clock size={12} color="#818cf8" /> {t.target_time_slot}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>Fleksibel (Bebas)</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {t.template_name} (v{t.version_number})
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {t.status === 'DONE' && (
                      <span className="status-pill status-done"><CheckCircle2 size={12} /> Selesai</span>
                    )}
                    {t.status === 'IN_PROGRESS' && (
                      <span className="status-pill status-in-progress"><Clock size={12} /> Draft In Progress</span>
                    )}
                    {t.status === 'NOT_STARTED' && (
                      <span className="status-pill status-not-started"><AlertCircle size={12} /> Belum Mulai</span>
                    )}
                    {t.status === 'REVISION_NEEDED' && (
                      <span className="status-pill status-revision"><AlertTriangle size={12} /> Revisi Diminta</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    {new Date(t.created_at).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div style={{ marginTop: '1rem' }}>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredTasks.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      {/* BATCH ASSIGNMENT MODAL */}
      {showBatchModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#38bdf8" />
                Penugasan Inspeksi Terjadwal (Scheduled Task Assignment)
              </h3>
              <button onClick={handleCloseModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Row 1: Petugas & Template */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">1. Tugaskan Kepada Petugas (Inspector)</label>
                  <select
                    className="form-select"
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                  >
                    {inspectors.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">2. Pilih Jenis Form Tugas</label>
                  <select
                    className="form-select"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      loadTemplateVersions(e.target.value);
                    }}
                  >
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>{tmpl.name} ({tmpl.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Tanggal Target Kamera */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#38bdf8" />
                    3. Pilih Tanggal Rekaman/Kamera yang Dicek
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    style={{ maxWidth: '280px' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                    Petugas akan diminta mengamati rekaman kamera CCTV pada tanggal ini.
                  </span>
                </div>
              </div>

              {/* Row 3: Jam Pengamatan Khusus People Counting */}
              {isPeopleCounting && (
                <div style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', color: '#c7d2fe' }}>
                        <Clock size={15} color="#818cf8" />
                        4. Tentukan Jam Berapa Saja yang Perlu Dicek ({selectedTimeSlots.length} Jam Terpilih)
                      </label>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        Sistem akan membuat tugas spesifik untuk setiap slot jam yang Anda centang.
                      </span>
                    </div>

                    {/* Presets */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={setPresetPeak}
                      >
                        <Zap size={11} color="#fbbf24" /> Jam Sibuk (3 Slot)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={setPresetEvery2Hours}
                      >
                        Tiap 2 Jam (5 Slot)
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={setPresetAllSlots}
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                        onClick={clearSlots}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Grid of Slots */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '8px',
                    marginTop: '0.75rem',
                  }}>
                    {STANDARD_TIME_SLOTS.map((slot) => {
                      const isSelected = selectedTimeSlots.includes(slot);
                      return (
                        <label
                          key={slot}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0.5rem 0.65rem',
                            background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                            border: `1px solid ${isSelected ? '#818cf8' : 'rgba(255, 255, 255, 0.08)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTimeSlot(slot)}
                          />
                          <span>{slot}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cameras Checklist */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    5. Pilih Kamera yang Akan Diperiksa ({selectedCamIds.length} Terpilih)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '2px', borderRadius: '4px' }}>
                      <button
                        type="button"
                        style={{
                          background: modalSystemFilter === 'ALL' ? 'var(--accent-cyan)' : 'transparent',
                          color: modalSystemFilter === 'ALL' ? '#000' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={() => setModalSystemFilter('ALL')}
                      >
                        Semua ({cameras.length})
                      </button>
                      <button
                        type="button"
                        style={{
                          background: modalSystemFilter === 'InaAI' ? '#0ea5e9' : 'transparent',
                          color: modalSystemFilter === 'InaAI' ? '#fff' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={() => setModalSystemFilter('InaAI')}
                      >
                        InaAI ({cameras.filter(c => c.system === 'InaAI').length})
                      </button>
                      <button
                        type="button"
                        style={{
                          background: modalSystemFilter === 'AEON' ? '#8b5cf6' : 'transparent',
                          color: modalSystemFilter === 'AEON' ? '#fff' : 'var(--text-dim)',
                          border: 'none',
                          borderRadius: '3px',
                          padding: '2px 6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        onClick={() => setModalSystemFilter('AEON')}
                      >
                        AEON ({cameras.filter(c => c.system === 'AEON').length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={selectAllCameras}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.8rem', cursor: 'pointer', padding: '2px 6px' }}
                    >
                      {selectedCamIds.length === cameras.length ? 'Batalkan Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {cameras
                    .filter((c) => modalSystemFilter === 'ALL' || c.system === modalSystemFilter)
                    .map((c) => (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '0.65rem',
                          background: selectedCamIds.includes(c.id) ? 'rgba(2, 132, 199, 0.15)' : 'var(--bg-card-subtle)',
                          border: `1px solid ${selectedCamIds.includes(c.id) ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCamIds.includes(c.id)}
                          onChange={() => toggleSelectCamera(c.id)}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff', lineHeight: 1.3 }}>
                              {c.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 700,
                                background: c.system === 'InaAI' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                                color: c.system === 'InaAI' ? '#38bdf8' : '#c084fc',
                                flexShrink: 0,
                              }}
                            >
                              {c.system || 'InaAI'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {c.code}
                            </span>
                            {c.nvr && (
                              <span style={{ fontSize: '0.7rem', color: '#818cf8', fontFamily: 'var(--font-mono)' }}>
                                {c.nvr} (Ch {c.channel_no || 1})
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Total Tugas Terbit: <strong>{selectedCamIds.length}</strong> Kamera × <strong>{isPeopleCounting ? selectedTimeSlots.length : 1}</strong> Slot = <strong style={{ color: '#38bdf8' }}>{totalTasksWillCreate} Tugas</strong>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={handleCloseModal}>
                  Batal
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleCreateBatch} 
                  disabled={submitting || selectedCamIds.length === 0 || (isPeopleCounting && selectedTimeSlots.length === 0)}
                >
                  Terbitkan {totalTasksWillCreate} Tugas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
