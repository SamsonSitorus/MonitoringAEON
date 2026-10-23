import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  X, 
  Layers, 
  User as UserIcon, 
  Search, 
  Check, 
  Trash2, 
  Plus, 
  EyeOff, 
  CalendarDays,
  Activity,
  Users
} from 'lucide-react';
import { api } from '../services/api';
import { Camera, CameraSystem, InspectionRecord, InspectionTask, User, SampleItem } from '../types';

interface WeeklyProgressMatrixViewProps {
  currentUser: User;
  onNavigateToTasks?: (cameraName?: string) => void;
}

interface DayInfo {
  dateStr: string;      // YYYY-MM-DD
  dayName: string;      // Senin, Selasa, dst.
  displayDate: string;  // 12 Sep
  fullDateLabel: string;// Sabtu, 12 September 2026
  isToday: boolean;
}

export const WeeklyProgressMatrixView: React.FC<WeeklyProgressMatrixViewProps> = ({ currentUser, onNavigateToTasks }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [inspectors, setInspectors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [systemFilter, setSystemFilter] = useState<'ALL' | CameraSystem>('ALL');
  const [nvrFilter, setNvrFilter] = useState<string>('ALL');
  const [progressFilter, setProgressFilter] = useState<'ALL' | 'DONE' | 'IN_PROGRESS' | 'NOT_STARTED' | 'UNASSIGNED' | 'REVISION'>('ALL');
  const [search, setSearch] = useState('');

  // Weekly Date Navigation state
  const getMonday = (d: Date): Date => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));

  // Slide-over Drawer State
  const [selectedCell, setSelectedCell] = useState<{
    camera: Camera;
    day: DayInfo;
    tasks: InspectionTask[];
  } | null>(null);

  // Quick Assign inside Drawer
  const [drawerAssignUserId, setDrawerAssignUserId] = useState<string>('');
  const [assigningDrawer, setAssigningDrawer] = useState(false);

  // Review action inside Drawer (for Supervisor)
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Reassign action inside Drawer (for Admin)
  const [reassigningTaskId, setReassigningTaskId] = useState<string | null>(null);
  const [newInspectorId, setNewInspectorId] = useState('');

  // Toast / feedback message
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [cams, ts, recs, usrs] = await Promise.all([
        api.getCameras(),
        api.getTasks(),
        api.getRecords(),
        api.getUsers('inspector'),
      ]);
      setCameras(cams);
      setTasks(ts);
      setRecords(recs);
      setInspectors(usrs);

      if (usrs.length > 0 && !drawerAssignUserId) {
        setDrawerAssignUserId(usrs[0].id);
      }

      // Keep open drawer synchronized with latest tasks
      setSelectedCell((prev) => {
        if (!prev) return null;
        const updatedTasks = ts.filter(
          (t) => t.camera_id === prev.camera.id && t.target_date === prev.day.dateStr
        );
        return {
          ...prev,
          tasks: updatedTasks,
        };
      });
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal memuat data matriks', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Compute 7 days from currentMonday
  const weekDays: DayInfo[] = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const fullMonthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const todayStr = new Date().toISOString().split('T')[0];

    return {
      dateStr,
      dayName: dayNames[d.getDay()],
      displayDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
      fullDateLabel: `${dayNames[d.getDay()]}, ${d.getDate()} ${fullMonthNames[d.getMonth()]} ${d.getFullYear()}`,
      isToday: dateStr === todayStr,
    };
  });

  const weekRangeLabel = `${weekDays[0].displayDate} - ${weekDays[6].displayDate} ${currentMonday.getFullYear()}`;

  // Week navigation
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleTodayWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Map tasks: key = `${camera_id}_${target_date}` -> InspectionTask[]
  const tasksByCamAndDate = new Map<string, InspectionTask[]>();
  tasks.forEach((t) => {
    if (t.target_date && t.camera_id) {
      const key = `${t.camera_id}_${t.target_date}`;
      const arr = tasksByCamAndDate.get(key) || [];
      arr.push(t);
      tasksByCamAndDate.set(key, arr);
    }
  });

  // Map records by task_id for instant inspection payload lookup
  const recordsByTaskId = new Map<string, InspectionRecord>();
  records.forEach((r) => {
    if (r.task_id) {
      recordsByTaskId.set(r.task_id, r);
    }
  });

  // Available NVRs for filter
  const availableNvrs = Array.from(new Set(cameras.map((c) => c.nvr).filter(Boolean)));

  // Filter cameras
  const filteredCameras = cameras.filter((c) => {
    if (systemFilter !== 'ALL' && c.system !== systemFilter) return false;
    if (nvrFilter !== 'ALL' && c.nvr !== nvrFilter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchName = c.name.toLowerCase().includes(term);
      const matchCode = c.code.toLowerCase().includes(term);
      const matchNvr = c.nvr?.toLowerCase().includes(term);
      if (!matchName && !matchCode && !matchNvr) return false;
    }
    if (progressFilter !== 'ALL') {
      const camWeekTasks = weekDays.map((d) => tasksByCamAndDate.get(`${c.id}_${d.dateStr}`) || []);
      if (progressFilter === 'DONE') {
        const hasDone = camWeekTasks.some((cell) => cell.length > 0 && cell.every((t) => t.status === 'DONE'));
        if (!hasDone) return false;
      } else if (progressFilter === 'IN_PROGRESS') {
        const hasProgress = camWeekTasks.some((cell) => cell.some((t) => t.status === 'IN_PROGRESS'));
        if (!hasProgress) return false;
      } else if (progressFilter === 'NOT_STARTED') {
        const hasNotStarted = camWeekTasks.some((cell) => cell.length > 0 && cell.every((t) => t.status === 'NOT_STARTED'));
        if (!hasNotStarted) return false;
      } else if (progressFilter === 'UNASSIGNED') {
        const hasUnassigned = camWeekTasks.some((cell) => cell.length === 0);
        if (!hasUnassigned) return false;
      } else if (progressFilter === 'REVISION') {
        const hasRevision = camWeekTasks.some((cell) => cell.some((t) => t.status === 'REVISION_NEEDED'));
        if (!hasRevision) return false;
      }
    }
    return true;
  });

  // Calculate overall stats for the current 7-day week
  const weekDateSet = new Set(weekDays.map((d) => d.dateStr));
  const weekTasks = tasks.filter((t) => t.target_date && weekDateSet.has(t.target_date));
  const totalWeekTasks = weekTasks.length;
  const doneWeekTasks = weekTasks.filter((t) => t.status === 'DONE').length;
  const inProgressWeekTasks = weekTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const notStartedWeekTasks = weekTasks.filter((t) => t.status === 'NOT_STARTED').length;
  const revisionWeekTasks = weekTasks.filter((t) => t.status === 'REVISION_NEEDED').length;
  const completionRate = totalWeekTasks > 0 ? Math.round((doneWeekTasks / totalWeekTasks) * 100) : 0;

  // Unassigned slots: cameras x 7 days with 0 tasks
  let totalUnassignedSlots = 0;
  cameras.forEach((c) => {
    weekDays.forEach((d) => {
      const key = `${c.id}_${d.dateStr}`;
      const cellTasks = tasksByCamAndDate.get(key) || [];
      if (cellTasks.length === 0) totalUnassignedSlots++;
    });
  });

  const isFiltering = systemFilter !== 'ALL' || nvrFilter !== 'ALL' || progressFilter !== 'ALL' || search.trim() !== '';

  const resetFilters = () => {
    setSystemFilter('ALL');
    setNvrFilter('ALL');
    setProgressFilter('ALL');
    setSearch('');
  };

  const handleCellClick = (cam: Camera, day: DayInfo) => {
    const key = `${cam.id}_${day.dateStr}`;
    const cellTasks = tasksByCamAndDate.get(key) || [];
    setSelectedCell({
      camera: cam,
      day,
      tasks: cellTasks,
    });
    setReviewingTaskId(null);
    setReassigningTaskId(null);
  };

  // Quick Assign from Drawer
  const handleQuickAssign = async () => {
    if (!selectedCell || !drawerAssignUserId) return;
    try {
      setAssigningDrawer(true);
      await api.batchCreateTasks({
        camera_ids: [selectedCell.camera.id],
        assigned_user_id: drawerAssignUserId,
        template_version_id: 'ver-eval-01',
        target_date: selectedCell.day.dateStr,
        target_time_slots: [], // No hour selection! 1 task with 3 sample target
      });
      setToast({ text: `Kamera ${selectedCell.camera.name} berhasil ditugaskan untuk tanggal ${selectedCell.day.displayDate}!`, type: 'success' });
      await loadAllData();
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal menugaskan kamera', type: 'error' });
    } finally {
      setAssigningDrawer(false);
    }
  };

  // Supervisor Review Action
  const handleReview = async (recordId: string, status: 'APPROVED' | 'REVISION_REQUESTED') => {
    if (!recordId) return;
    try {
      setSubmittingReview(true);
      await api.reviewRecord(recordId, status, reviewNotes);
      setToast({
        text: status === 'APPROVED' ? 'Hasil evaluasi kamera disetujui (Approved)' : 'Permintaan revisi berhasil dikirim',
        type: 'success',
      });
      setReviewingTaskId(null);
      setReviewNotes('');
      await loadAllData();
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal mereview laporan', type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Admin Reassign Task
  const handleReassign = async (taskId: string) => {
    if (!newInspectorId) return;
    try {
      await api.reassignTask(taskId, newInspectorId);
      setToast({ text: 'Petugas berhasil dialihkan!', type: 'success' });
      setReassigningTaskId(null);
      setNewInspectorId('');
      await loadAllData();
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal mengalihkan petugas', type: 'error' });
    }
  };

  // Admin Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Yakin ingin membatalkan penugasan kamera ini?')) return;
    try {
      await api.deleteTask(taskId);
      setToast({ text: 'Penugasan kamera berhasil dibatalkan', type: 'success' });
      await loadAllData();
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal menghapus tugas', type: 'error' });
    }
  };

  // Helper to extract sample progress
  const getSampleInfo = (task: InspectionTask) => {
    if (task.status === 'DONE') {
      return { completed: 3, total: 3, label: '3/3 Selesai' };
    }
    const samples = task.draft_data?.samples;
    if (Array.isArray(samples)) {
      const c = samples.filter((s: any) => s.is_completed).length;
      return { completed: c, total: 3, label: `${c}/3 Sample` };
    }
    if (task.status === 'IN_PROGRESS') {
      return { completed: 1, total: 3, label: 'Sedang Dicek' };
    }
    return { completed: 0, total: 3, label: '0/3 Sample' };
  };

  return (
    <div className="page-wrapper">
      {/* HEADER */}
      <div className="page-header">
        <div className="page-title-group">
          <h2>Checklist Kamera & Tanggal (61 Kamera / 7 Hari)</h2>
          <p>Pantau ketercapaian evaluasi 3 sample untuk seluruh 61 kamera CCTV per hari dalam siklus 7 hari mingguan.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadAllData}>
            <RefreshCw size={16} /> Perbarui Data
          </button>
        </div>
      </div>

      {toast && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${toast.type === 'success' ? '#10b981' : '#f43f5e'}`,
            color: toast.type === 'success' ? '#34d399' : '#fb7185',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* TOP SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Layers size={13} color="var(--accent-cyan)" /> Total Tugas Minggu Ini
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>{totalWeekTasks}</div>
          <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>Rentang: {weekRangeLabel}</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={13} color="#10b981" /> Selesai Dievaluasi
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>{completionRate}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {doneWeekTasks} dari {totalWeekTasks} tugas tuntas
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} color="#f59e0b" /> Sedang Dikerjakan
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24' }}>{inProgressWeekTasks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Draft sample tersimpan</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #64748b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} color="#94a3b8" /> Belum Mulai
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#cbd5e1' }}>{notStartedWeekTasks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Sudah di-assign</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #475569' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <EyeOff size={13} color="#94a3b8" /> Belum Ditugaskan
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#94a3b8' }}>{totalUnassignedSlots}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Titik belum ada jadwal</div>
        </div>

        {revisionWeekTasks > 0 && (
          <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <AlertTriangle size={13} color="#8b5cf6" /> Perlu Revisi
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#c084fc' }}>{revisionWeekTasks}</div>
            <div style={{ fontSize: '0.75rem', color: '#c084fc', marginTop: '4px' }}>Meminta perbaikan</div>
          </div>
        )}
      </div>

      {/* WEEK NAVIGATION & REFINED FILTER TOOLBAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Tier 1: Weekly Navigation Bar */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
              onClick={handlePrevWeek}
              title="Minggu Sebelumnya"
            >
              <ChevronLeft size={16} /> Minggu Sebelumnya
            </button>

            <div
              style={{
                padding: '0.45rem 1rem',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Calendar size={15} />
              <span>{weekRangeLabel}</span>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
              onClick={handleNextWeek}
              title="Minggu Berikutnya"
            >
              Minggu Berikutnya <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
              onClick={handleTodayWeek}
              title="Kembali ke Minggu Ini"
            >
              Minggu Ini
            </button>
          </div>

          {/* Visual Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} />
              3/3 Selesai
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }} />
              Sedang Dicek
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#0ea5e9' }} />
              Belum Mulai
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.2)' }} />
              Belum Dicek
            </span>
          </div>
        </div>

        {/* Tier 2: Filter Toolbar */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* System Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Sistem:</span>
              <select
                className="form-select"
                value={systemFilter}
                onChange={(e) => setSystemFilter(e.target.value as any)}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
              >
                <option value="ALL">Semua Sistem</option>
                <option value="InaAI">InaAI (40 Cam)</option>
                <option value="AEON">AEON (21 Cam)</option>
              </select>
            </div>

            {/* NVR Filter */}
            {availableNvrs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>NVR:</span>
                <select
                  className="form-select"
                  value={nvrFilter}
                  onChange={(e) => setNvrFilter(e.target.value)}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
                >
                  <option value="ALL">Semua NVR</option>
                  {availableNvrs.map((nvr) => (
                    <option key={nvr} value={nvr}>{nvr}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Progress Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Status:</span>
              <select
                className="form-select"
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value as any)}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: 'auto' }}
              >
                <option value="ALL">Semua Status</option>
                <option value="DONE">Selesai (Done)</option>
                <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                <option value="NOT_STARTED">Belum Mulai</option>
                <option value="UNASSIGNED">Belum Ditugaskan</option>
                <option value="REVISION">Perlu Revisi</option>
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-dim)' }} />
              <input
                className="form-input"
                style={{ width: '100%', paddingLeft: '2.1rem', fontSize: '0.8rem', padding: '0.35rem 0.6rem 0.35rem 2.1rem' }}
                placeholder="Cari 61 kamera..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: 8, background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {isFiltering && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetFilters}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
              >
                Reset
              </button>
            )}

            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Total: <strong>{filteredCameras.length}</strong> / {cameras.length} Kamera
            </span>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE: 61 CAMERAS x 7 DAYS */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '920px' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '1rem', width: '280px', color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase' }}>
                KAMERA CCTV (61 UNIT)
              </th>
              {weekDays.map((d) => (
                <th
                  key={d.dateStr}
                  style={{
                    padding: '0.85rem 0.5rem',
                    textAlign: 'center',
                    borderLeft: '1px solid var(--border-subtle)',
                    background: d.isToday ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: d.isToday ? 'var(--accent-cyan)' : 'var(--text-dim)', textTransform: 'uppercase' }}>
                    {d.dayName}
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: d.isToday ? '#ffffff' : 'var(--text-main)' }}>
                    {d.displayDate}
                  </div>
                  {d.isToday && (
                    <span style={{ fontSize: '0.62rem', background: 'var(--accent-cyan)', color: '#000', padding: '1px 5px', borderRadius: '3px', fontWeight: 800 }}>
                      HARI INI
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  Memuat matriks progress 61 kamera...
                </td>
              </tr>
            ) : filteredCameras.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  Tidak ada kamera yang cocok dengan kriteria filter.
                </td>
              </tr>
            ) : (
              filteredCameras.map((cam) => (
                <tr key={cam.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {/* Camera Row Header */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontWeight: 700,
                          background: cam.system === 'InaAI' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                          border: `1px solid ${cam.system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                          color: cam.system === 'InaAI' ? '#38bdf8' : '#c084fc',
                        }}
                      >
                        {cam.system || 'InaAI'}
                      </span>
                      {cam.nvr && (
                        <span style={{ fontSize: '0.7rem', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                          {cam.nvr} (Ch {cam.channel_no || 1})
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.88rem' }}>{cam.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {cam.code}
                    </div>
                  </td>

                  {/* 7 Daily Cells for this camera */}
                  {weekDays.map((d) => {
                    const key = `${cam.id}_${d.dateStr}`;
                    const cellTasks = tasksByCamAndDate.get(key) || [];
                    const firstTask = cellTasks[0];
                    const sampleInfo = firstTask ? getSampleInfo(firstTask) : null;
                    const hasRevision = cellTasks.some((t) => t.status === 'REVISION_NEEDED');

                    return (
                      <td
                        key={d.dateStr}
                        onClick={() => handleCellClick(cam, d)}
                        style={{
                          padding: '0.65rem 0.4rem',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          borderLeft: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: d.isToday ? 'rgba(56, 189, 248, 0.03)' : 'transparent',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = d.isToday ? 'rgba(56, 189, 248, 0.03)' : 'transparent';
                        }}
                        title={`Klik untuk melihat detail atau menugaskan ${cam.name} pada ${d.fullDateLabel}`}
                      >
                        {cellTasks.length === 0 ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px dashed rgba(255, 255, 255, 0.15)',
                              color: 'var(--text-dim)',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                            }}
                          >
                            <EyeOff size={11} color="var(--text-dim)" />
                            <span>Belum Dicek</span>
                          </div>
                        ) : hasRevision ? (
                          <div>
                            <div
                              style={{
                                background: 'rgba(244, 63, 94, 0.16)',
                                border: '1px solid rgba(244, 63, 94, 0.4)',
                                color: '#fb7185',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <RefreshCw size={11} />
                              <span>Revisi</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px', margin: '2px auto 0' }}>
                              {firstTask.assigned_user_name}
                            </div>
                          </div>
                        ) : firstTask.status === 'DONE' ? (
                          <div>
                            <div
                              style={{
                                background: 'rgba(16, 185, 129, 0.16)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#34d399',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={12} color="#34d399" />
                              <span>3/3 Selesai</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px', margin: '2px auto 0' }}>
                              {firstTask.assigned_user_name}
                            </div>
                          </div>
                        ) : firstTask.status === 'IN_PROGRESS' ? (
                          <div>
                            <div
                              style={{
                                background: 'rgba(245, 158, 11, 0.16)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                color: '#fbbf24',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Clock size={11} color="#fbbf24" />
                              <span>{sampleInfo?.label || 'Sedang Dicek'}</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px', margin: '2px auto 0' }}>
                              {firstTask.assigned_user_name}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div
                              style={{
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <AlertCircle size={11} color="#38bdf8" />
                              <span>0/3 Sample</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '95px', margin: '2px auto 0' }}>
                              {firstTask.assigned_user_name}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* SLIDE-OVER RIGHT DRAWER (DETAIL INSPEKSI & EVALUASI 3 SAMPLE) */}
      {selectedCell && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedCell(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '580px',
              height: '100%',
              background: '#0d1527',
              borderLeft: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: selectedCell.camera.system === 'InaAI' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                      border: `1px solid ${selectedCell.camera.system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                      color: selectedCell.camera.system === 'InaAI' ? '#38bdf8' : '#c084fc',
                    }}
                  >
                    {selectedCell.camera.system || 'InaAI'}
                  </span>
                  {selectedCell.camera.nvr && (
                    <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                      🖥️ {selectedCell.camera.nvr} (Ch {selectedCell.camera.channel_no || 1})
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  {selectedCell.camera.name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                  {selectedCell.camera.code}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, marginTop: '6px' }}>
                  <Calendar size={14} /> {selectedCell.day.fullDateLabel}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCell(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto' }}>
              {selectedCell.tasks.length === 0 ? (
                /* Unassigned State: Show Quick Assign Form */
                <div>
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(255, 255, 255, 0.2)', borderRadius: '10px', marginBottom: '1.25rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                      <EyeOff size={24} color="#fb7185" />
                    </div>
                    <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.98rem' }}>Kamera Belum Ditugaskan</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '380px', margin: '4px auto 0' }}>
                      Belum ada personil yang ditugaskan memeriksa kamera ini pada tanggal {selectedCell.day.displayDate}.
                    </p>
                  </div>

                  {currentUser.role === 'admin' && (
                    <div style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} /> Tugaskan Kamera Ini Sekarang
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                        Petugas yang dipilih akan menerima tugas memeriksa 3 sample pada kamera ini (Traffic, Actions, Age, Gender).
                      </p>

                      <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Pilih Petugas (Inspector):</label>
                        <select
                          className="form-select"
                          value={drawerAssignUserId}
                          onChange={(e) => setDrawerAssignUserId(e.target.value)}
                        >
                          {inspectors.map((u) => (
                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleQuickAssign}
                        disabled={assigningDrawer || !drawerAssignUserId}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {assigningDrawer ? 'Menugaskan...' : 'Tugaskan Kamera Ini (Target: 3 Sample)'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Assigned Task Details & 3 Samples Breakdown */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedCell.tasks.map((task) => {
                    const record = recordsByTaskId.get(task.id);
                    const p = record?.payload || task.draft_data || {};
                    const samplesArr: SampleItem[] = Array.isArray(p.samples)
                      ? p.samples
                      : [
                          { sample_number: 1, is_completed: task.status === 'DONE', traffic: p.traffic || p.total_people || 0, actions: p.actions || [], male_count: p.male_count || 0, female_count: p.female_count || 0 },
                          { sample_number: 2, is_completed: task.status === 'DONE', traffic: 0, actions: [], male_count: 0, female_count: 0 },
                          { sample_number: 3, is_completed: task.status === 'DONE', traffic: 0, actions: [], male_count: 0, female_count: 0 },
                        ];
                    const doneCount = samplesArr.filter((s) => s.is_completed).length;

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '1.25rem',
                        }}
                      >
                        {/* Task Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Petugas yang Ditugaskan:</div>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <UserIcon size={15} color="var(--accent-cyan)" /> {task.assigned_user_name}
                            </div>
                          </div>

                          <div>
                            {task.status === 'DONE' && (
                              <span className="status-pill status-done"><CheckCircle2 size={12} /> 3/3 Selesai</span>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <span className="status-pill status-in-progress"><Clock size={12} /> {doneCount}/3 Sample</span>
                            )}
                            {task.status === 'NOT_STARTED' && (
                              <span className="status-pill status-not-started"><AlertCircle size={12} /> Belum Mulai</span>
                            )}
                            {task.status === 'REVISION_NEEDED' && (
                              <span className="status-pill status-revision"><AlertTriangle size={12} /> Revisi Diminta</span>
                            )}
                          </div>
                        </div>

                        {/* Admin Action: Reassign or Delete */}
                        {currentUser.role === 'admin' && task.status !== 'DONE' && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.78rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setReassigningTaskId(reassigningTaskId === task.id ? null : task.id);
                                setNewInspectorId(task.assigned_user_id);
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                            >
                              Ganti Petugas...
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                            >
                              Batalkan Penugasan
                            </button>
                          </div>
                        )}

                        {/* Inline Reassign Box */}
                        {reassigningTaskId === task.id && (
                          <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
                              Alihkan Tugas ke Petugas Lain:
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <select
                                className="form-select"
                                value={newInspectorId}
                                onChange={(e) => setNewInspectorId(e.target.value)}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                              >
                                {inspectors.map((ins) => (
                                  <option key={ins.id} value={ins.id}>{ins.name} ({ins.email})</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                onClick={() => handleReassign(task.id)}
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 3 SAMPLES BREAKDOWN */}
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
                            Detail 3 Sample Evaluasi:
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {samplesArr.map((sample, sIdx) => (
                              <div
                                key={sIdx}
                                style={{
                                  background: 'rgba(0, 0, 0, 0.25)',
                                  border: `1px solid ${sample.is_completed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                                  borderRadius: '6px',
                                  padding: '0.75rem',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#ffffff' }}>
                                    Sample {sample.sample_number || sIdx + 1}
                                  </div>
                                  <span style={{
                                    fontSize: '0.7rem',
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    fontWeight: 700,
                                    background: sample.is_completed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    color: sample.is_completed ? '#34d399' : 'var(--text-dim)',
                                  }}>
                                    {sample.is_completed ? '✓ Selesai Diceklis' : 'Belum Diceklis'}
                                  </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px', fontSize: '0.78rem' }}>
                                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                                    <span style={{ color: 'var(--text-dim)' }}>Traffic: </span>
                                    <strong style={{ color: '#38bdf8' }}>{sample.traffic || 0} Orang</strong>
                                  </div>

                                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '4px 6px', borderRadius: '4px' }}>
                                    <span style={{ color: 'var(--text-dim)' }}>Gender: </span>
                                    <span>P: {sample.male_count || 0} / W: {sample.female_count || 0}</span>
                                  </div>

                                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '4px 6px', borderRadius: '4px', gridColumn: 'span 2' }}>
                                    <span style={{ color: 'var(--text-dim)' }}>Usia (Age): </span>
                                    <strong style={{ color: '#fbbf24' }}>{sample.dominant_age || 'Dewasa'}</strong>
                                  </div>
                                </div>

                                {sample.actions && sample.actions.length > 0 && (
                                  <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {sample.actions.map((act) => (
                                      <span key={act} style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '0.68rem', background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                        {act}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {sample.notes && (
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '4px' }}>
                                    "{sample.notes}"
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Supervisor Review Action Box */}
                        {task.status === 'DONE' && record && (
                          <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Verifikasi Supervisor:</span>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: record.review_status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : record.review_status === 'REVISION_REQUESTED' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: record.review_status === 'APPROVED' ? '#34d399' : record.review_status === 'REVISION_REQUESTED' ? '#fb7185' : '#fbbf24',
                              }}>
                                {record.review_status === 'APPROVED' ? '✓ APPROVED' : record.review_status === 'REVISION_REQUESTED' ? '🔄 REVISI DIMINTA' : 'MENUNGGU REVIEW'}
                              </span>
                            </div>

                            {currentUser.role === 'supervisor' && (
                              <div>
                                {reviewingTaskId !== task.id ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#10b981', borderColor: '#10b981' }}
                                      onClick={() => handleReview(record.id, 'APPROVED')}
                                      disabled={submittingReview}
                                    >
                                      <Check size={12} /> Setujui
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                                      onClick={() => setReviewingTaskId(task.id)}
                                    >
                                      Minta Revisi...
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ background: 'rgba(244, 63, 94, 0.08)', padding: '0.65rem', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      value={reviewNotes}
                                      onChange={(e) => setReviewNotes(e.target.value)}
                                      placeholder="Catatan alasan revisi ke petugas..."
                                      style={{ fontSize: '0.78rem', marginBottom: '6px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#f43f5e', borderColor: '#f43f5e' }}
                                        onClick={() => handleReview(record.id, 'REVISION_REQUESTED')}
                                        disabled={submittingReview}
                                      >
                                        Kirim Revisi
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                                        onClick={() => setReviewingTaskId(null)}
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {selectedCell.camera.code} · {selectedCell.day.dateStr}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedCell(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
