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
  Check,
  CalendarDays,
  Layers,
  Search,
  X,
  Trash2,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { InspectionTask, Camera as CameraType, User, FormTemplate } from '../types';
import { Pagination } from './Pagination';

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
  
  // Scheduled Target Date (No hour selection!)
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Pagination states for task table
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>(initialSearch || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [modalSystemFilter, setModalSystemFilter] = useState<'ALL' | 'InaAI' | 'AEON'>('ALL');
  const [modalCameraSearch, setModalCameraSearch] = useState<string>('');

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

      if (uData.length > 0 && !assignedUserId) {
        setAssignedUserId(uData[0].id);
      }
      
      // Select evaluation template by default if available
      const evalTmpl = tmplData.find(t => t.code === 'FORM-EVALUATION') || tmplData[0];
      if (evalTmpl) {
        setSelectedTemplateId(evalTmpl.id);
        loadTemplateVersions(evalTmpl.id);
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

  const handleCreateBatch = async () => {
    if (selectedCamIds.length === 0) {
      alert('Pilih minimal satu kamera untuk ditugaskan!');
      return;
    }
    if (!assignedUserId) {
      alert('Pilih petugas yang akan ditugaskan!');
      return;
    }

    // Fallback template version if not loaded
    let versionId = selectedVersionId;
    if (!versionId && templates.length > 0) {
      try {
        const full = await api.getFormTemplate(selectedTemplateId || templates[0].id);
        if (full.versions && full.versions.length > 0) {
          versionId = full.versions[0].id;
        }
      } catch {
        // ignore
      }
    }

    try {
      setSubmitting(true);
      await api.batchCreateTasks({
        camera_ids: selectedCamIds,
        assigned_user_id: assignedUserId,
        template_version_id: versionId || 'ver-eval-01',
        target_date: targetDate,
        target_time_slots: [], // No hour selection! 1 task per camera
      });
      
      const assignedUser = inspectors.find(u => u.id === assignedUserId)?.name || 'Petugas';
      setMessage({ 
        text: `Sukses! ${selectedCamIds.length} kamera berhasil ditugaskan ke ${assignedUser} untuk tanggal ${targetDate} (Target: 3 Sample per Kamera).`, 
        type: 'success' 
      });
      setShowBatchModal(false);
      setSelectedCamIds([]);
      await loadAllData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mendistribusikan penugasan', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Yakin ingin membatalkan penugasan kamera ini?')) return;
    try {
      await api.deleteTask(taskId);
      setMessage({ text: 'Penugasan kamera berhasil dibatalkan.', type: 'success' });
      await loadAllData();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menghapus penugasan', type: 'error' });
    }
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

  // Filter tasks based on date preset, custom date, status, and search
  const filteredTasks = tasks.filter((t) => {
    if (datePreset === 'TODAY') {
      if (t.target_date !== todayStr) return false;
    } else if (datePreset === 'THIS_WEEK') {
      if (!t.target_date || t.target_date < weekStartStr || t.target_date > weekEndStr) return false;
    } else if (datePreset === 'THIS_MONTH') {
      if (!t.target_date || !t.target_date.startsWith(currentMonthPrefix)) return false;
    } else if (datePreset === 'CUSTOM') {
      if (customDate && t.target_date !== customDate) return false;
    }

    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCam = t.camera_name?.toLowerCase().includes(q) || t.camera_code?.toLowerCase().includes(q);
      const matchInsp = t.assigned_user_name?.toLowerCase().includes(q);
      if (!matchCam && !matchInsp) return false;
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

  // Helper to extract sample progress from task draft/payload
  const getSampleProgress = (task: InspectionTask) => {
    if (task.status === 'DONE') {
      return { completed: 3, total: 3, label: '3/3 Sample Selesai' };
    }
    const samples = task.draft_data?.samples;
    if (Array.isArray(samples)) {
      const completedCount = samples.filter((s: any) => s.is_completed).length;
      return { completed: completedCount, total: 3, label: `${completedCount}/3 Sample` };
    }
    if (task.status === 'IN_PROGRESS') {
      return { completed: 1, total: 3, label: 'Sedang Dicek' };
    }
    return { completed: 0, total: 3, label: '0/3 Sample' };
  };

  // Filtered cameras for batch assignment modal
  const filteredModalCameras = cameras.filter((c) => {
    if (modalSystemFilter !== 'ALL' && c.system !== modalSystemFilter) return false;
    if (modalCameraSearch.trim()) {
      const q = modalCameraSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.nvr && c.nvr.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Penugasan Kamera & Sample</h2>
          <p>Tugaskan kamera CCTV dan tanggal evaluasi kepada personil (Petugas). Setiap kamera yang ditugaskan memiliki 3 sample evaluasi (Traffic, Actions, Age, Gender).</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadAllData}>
            <RefreshCw size={16} /> Perbarui Data
          </button>
          <button className="btn btn-primary" onClick={() => setShowBatchModal(true)}>
            <Plus size={16} /> Tugaskan Kamera
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            color: message.type === 'success' ? '#34d399' : '#fb7185',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* QUICK SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={13} color="var(--accent-cyan)" /> Total Kamera Ditugaskan
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>{tasks.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>Target: 3 Sample / Kamera</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> Selesai Evaluasi (Done)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>
            {tasks.filter((t) => t.status === 'DONE').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>3/3 Sample selesai diperiksa</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} color="#f59e0b" /> Sedang Dikerjakan (In Progress)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24' }}>
            {tasks.filter((t) => t.status === 'IN_PROGRESS').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Draft pemeriksaan tersimpan</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #64748b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} color="#94a3b8" /> Belum Mulai
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#cbd5e1' }}>
            {tasks.filter((t) => t.status === 'NOT_STARTED').length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Menunggu personil bertugas</div>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <CalendarDays size={14} color="#38bdf8" /> Tanggal:
            </span>
            {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map((preset) => {
              const labels: Record<string, string> = {
                ALL: 'Semua',
                TODAY: 'Hari Ini',
                THIS_WEEK: 'Minggu Ini',
                THIS_MONTH: 'Bulan Ini',
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
                    padding: '0.35rem 0.75rem',
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

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Status:</span>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
            >
              <option value="ALL">Semua Status</option>
              <option value="DONE">Selesai (Done)</option>
              <option value="IN_PROGRESS">Dalam Pengerjaan</option>
              <option value="NOT_STARTED">Belum Mulai</option>
              <option value="REVISION_NEEDED">Perlu Revisi</option>
            </select>
          </div>
        </div>

        {/* Second Row: Search & Count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', maxWidth: '340px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              style={{ width: '100%', paddingLeft: '2.1rem', fontSize: '0.8rem', padding: '0.38rem 0.6rem 0.38rem 2.1rem' }}
              placeholder="Cari kamera atau nama petugas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Menampilkan <strong style={{ color: '#ffffff' }}>{filteredTasks.length}</strong> dari{' '}
              <strong>{tasks.length}</strong> total penugasan
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
              <th style={{ padding: '0.85rem 1.25rem' }}>KAMERA CCTV</th>
              <th style={{ padding: '0.85rem 1rem' }}>PETUGAS (PERSONIL)</th>
              <th style={{ padding: '0.85rem 1rem' }}>TANGGAL EVALUASI</th>
              <th style={{ padding: '0.85rem 1rem' }}>PROGRES SAMPLE</th>
              <th style={{ padding: '0.85rem 1rem' }}>STATUS TUGAS</th>
              <th style={{ padding: '0.85rem 1rem' }}>TANGGAL TERBIT</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                  Tidak ada data penugasan kamera yang cocok dengan kriteria filter.
                </td>
              </tr>
            ) : (
              paginatedTasks.map((t) => {
                const sampleProg = getSampleProgress(t);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '1rem 1.25rem' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#38bdf8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}>
                          {t.assigned_user_name ? t.assigned_user_name.substring(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.assigned_user_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Inspector</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '5px', 
                        background: 'rgba(56, 189, 248, 0.1)', 
                        color: '#38bdf8', 
                        padding: '3px 9px', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem', 
                        fontWeight: 600 
                      }}>
                        <Calendar size={13} /> {t.target_date || '-'}
                      </span>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: sampleProg.completed === 3 
                            ? 'rgba(16, 185, 129, 0.15)' 
                            : sampleProg.completed > 0 
                            ? 'rgba(245, 158, 11, 0.15)' 
                            : 'rgba(255, 255, 255, 0.05)',
                          color: sampleProg.completed === 3 
                            ? '#34d399' 
                            : sampleProg.completed > 0 
                            ? '#fbbf24' 
                            : 'var(--text-dim)',
                          border: `1px solid ${
                            sampleProg.completed === 3 
                              ? 'rgba(16, 185, 129, 0.3)' 
                              : sampleProg.completed > 0 
                              ? 'rgba(245, 158, 11, 0.3)' 
                              : 'var(--border-subtle)'
                          }`
                        }}>
                          {sampleProg.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px', display: 'block' }}>
                        Traffic, Actions, Age, Gender
                      </span>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      {t.status === 'DONE' && (
                        <span className="status-pill status-done"><CheckCircle2 size={12} /> Selesai</span>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <span className="status-pill status-in-progress"><Clock size={12} /> Sedang Dikerjakan</span>
                      )}
                      {t.status === 'NOT_STARTED' && (
                        <span className="status-pill status-not-started"><AlertCircle size={12} /> Belum Mulai</span>
                      )}
                      {t.status === 'REVISION_NEEDED' && (
                        <span className="status-pill status-revision"><AlertTriangle size={12} /> Revisi Diminta</span>
                      )}
                    </td>

                    <td style={{ padding: '1rem', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      {new Date(t.created_at).toLocaleDateString('id-ID')}
                    </td>

                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(t.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)', fontSize: '0.75rem' }}
                        title="Batalkan / Hapus Penugasan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
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

      {/* BATCH ASSIGNMENT MODAL (NO HOUR SELECTION) */}
      {showBatchModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} color="#38bdf8" />
                Penugasan Kamera & Target Sample
              </h3>
              <button 
                onClick={() => setShowBatchModal(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Instructions banner */}
              <div style={{
                padding: '0.85rem 1rem',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}>
                <Info size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.82rem', color: '#e0f2fe' }}>
                  <strong>Alur Penugasan Kamera:</strong> Tugaskan personil (misal Orang A) ke kamera yang diinginkan (misal Kamera 2 dan 5) pada tanggal target tertentu. 
                  Petugas bertugas memeriksa <strong>3 sample</strong> pada masing-masing kamera tersebut, mencatat <strong>Traffic (jumlah orang), Actions, Age, dan Gender</strong>, serta menceklis jika sample telah selesai diperiksa.
                </div>
              </div>

              {/* Step 1 & 2: Petugas & Tanggal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">1. Pilih Petugas yang Ditugaskan</label>
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
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="#38bdf8" />
                    2. Tanggal Rekaman / Evaluasi
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Step 3: Pilih Kamera (61 Unit Available) */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={15} color="#38bdf8" />
                    3. Pilih Kamera yang Ditugaskan ({selectedCamIds.length} terpilih)
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* System Filter Pill */}
                    {(['ALL', 'InaAI', 'AEON'] as const).map((sys) => (
                      <button
                        key={sys}
                        type="button"
                        onClick={() => setModalSystemFilter(sys)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: modalSystemFilter === sys ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                          background: modalSystemFilter === sys ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                          color: modalSystemFilter === sys ? '#38bdf8' : 'var(--text-dim)',
                        }}
                      >
                        {sys}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={selectAllCameras}
                      style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                    >
                      {selectedCamIds.length === cameras.length ? 'Batal Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                </div>

                {/* Search inside modal */}
                <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-dim)' }} />
                  <input
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '2.1rem', fontSize: '0.8rem', padding: '0.35rem 0.6rem 0.35rem 2.1rem' }}
                    placeholder="Cari kamera berdasarkan nama, kode, atau NVR..."
                    value={modalCameraSearch}
                    onChange={(e) => setModalCameraSearch(e.target.value)}
                  />
                  {modalCameraSearch && (
                    <button
                      type="button"
                      onClick={() => setModalCameraSearch('')}
                      style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Camera Grid */}
                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.2)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {filteredModalCameras.map((cam) => {
                    const isSelected = selectedCamIds.includes(cam.id);
                    return (
                      <div
                        key={cam.id}
                        onClick={() => toggleSelectCamera(cam.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #0284c7' : '1px solid rgba(255, 255, 255, 0.06)',
                          background: isSelected ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent div
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isSelected ? '#ffffff' : '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cam.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', gap: '6px' }}>
                            <span>{cam.code}</span>
                            <span>•</span>
                            <span style={{ color: cam.system === 'InaAI' ? '#38bdf8' : '#c084fc' }}>{cam.system}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary of what will be assigned */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}>
                <div style={{ fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Total Kamera yang Ditugaskan: </span>
                  <strong style={{ color: '#38bdf8' }}>{selectedCamIds.length} Kamera</strong>
                  <span style={{ color: 'var(--text-dim)', marginLeft: '8px' }}>(Total: {selectedCamIds.length * 3} Sample Target)</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Tanggal: <strong style={{ color: '#ffffff' }}>{targetDate}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBatchModal(false)} disabled={submitting}>
                Batal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateBatch}
                disabled={submitting || selectedCamIds.length === 0}
              >
                {submitting ? 'Memproses...' : `Terbitkan Penugasan (${selectedCamIds.length} Kamera)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
