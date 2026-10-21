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
  Server, 
  MapPin, 
  User as UserIcon, 
  Search, 
  Filter,
  Check,
  Send,
  Trash2,
  Plus,
  ShieldCheck,
  Eye,
  EyeOff,
  Camera as CameraIcon,
  CalendarDays,
  Percent
} from 'lucide-react';
import { api } from '../services/api';
import { Camera, CameraSystem, InspectionRecord, InspectionTask, User } from '../types';

interface WeeklyProgressMatrixViewProps {
  currentUser: User;
}

interface DayInfo {
  dateStr: string;      // YYYY-MM-DD
  dayName: string;      // Senin, Selasa, dst.
  displayDate: string;  // 12 Sep
  fullDateLabel: string;// Sabtu, 12 September 2026
  isToday: boolean;
}

export const WeeklyProgressMatrixView: React.FC<WeeklyProgressMatrixViewProps> = ({ currentUser }) => {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [inspectors, setInspectors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [systemFilter, setSystemFilter] = useState<'ALL' | CameraSystem>('ALL');
  const [nvrFilter, setNvrFilter] = useState<string>('ALL');
  const [progressFilter, setProgressFilter] = useState<'ALL' | 'DONE' | 'IN_PROGRESS' | 'NOT_STARTED' | 'BLINDSPOT' | 'REVISION'>('ALL');
  const [search, setSearch] = useState('');

  // Weekly Date Navigation state
  // Helper: compute Monday of current date
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

  // Review action inside Drawer (for Supervisor)
  const [reviewingTaskId, setReviewingTaskId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Reassign action inside Drawer (for Admin)
  const [reassigningTaskId, setReassigningTaskId] = useState<string | null>(null);
  const [newInspectorId, setNewInspectorId] = useState('');

  // Quick Add Slot Modal State (for Admin)
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('08:00 - 09:00 WIB');
  const [newSlotInspectorId, setNewSlotInspectorId] = useState('');

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
      if (usrs.length > 0 && !newSlotInspectorId) {
        setNewSlotInspectorId(usrs[0].id);
      }
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

  // Filter cameras with search, system, NVR, and progress/blindspot filter
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
      } else if (progressFilter === 'BLINDSPOT') {
        // Blindspot: Camera has at least one day without any task scheduled
        const hasBlindspot = camWeekTasks.some((cell) => cell.length === 0);
        if (!hasBlindspot) return false;
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

  // Count total blindspot days (camera x day with 0 tasks scheduled)
  let totalBlindspotSlots = 0;
  cameras.forEach((c) => {
    weekDays.forEach((d) => {
      const key = `${c.id}_${d.dateStr}`;
      const cellTasks = tasksByCamAndDate.get(key) || [];
      if (cellTasks.length === 0) totalBlindspotSlots++;
    });
  });

  const isFiltering = systemFilter !== 'ALL' || nvrFilter !== 'ALL' || progressFilter !== 'ALL' || search.trim() !== '';

  const resetFilters = () => {
    setSystemFilter('ALL');
    setNvrFilter('ALL');
    setProgressFilter('ALL');
    setSearch('');
  };

  // Handle cell click
  const handleCellClick = (cam: Camera, day: DayInfo) => {
    const key = `${cam.id}_${day.dateStr}`;
    const cellTasks = tasksByCamAndDate.get(key) || [];
    setSelectedCell({
      camera: cam,
      day,
      tasks: cellTasks,
    });
  };

  // Re-sync selectedCell tasks when tasks state updates
  const refreshSelectedCell = (camId: string, dateStr: string, currentTasks: InspectionTask[]) => {
    const key = `${camId}_${dateStr}`;
    const cellTasks = currentTasks.filter((t) => t.camera_id === camId && t.target_date === dateStr);
    if (selectedCell) {
      setSelectedCell({
        ...selectedCell,
        tasks: cellTasks,
      });
    }
  };

  // Supervisor Review Action
  const handleReview = async (recordId: string, status: 'APPROVED' | 'REVISION_REQUESTED') => {
    if (!recordId) return;
    try {
      setSubmittingReview(true);
      await api.reviewRecord(recordId, status, reviewNotes);
      setToast({
        text: status === 'APPROVED' ? 'Hasil inspeksi disetujui (Approved)' : 'Permintaan revisi berhasil dikirim',
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
    if (!window.confirm('Yakin ingin membatalkan slot tugas ini?')) return;
    try {
      await api.deleteTask(taskId);
      setToast({ text: 'Slot tugas berhasil dibatalkan', type: 'success' });
      await loadAllData();
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal menghapus tugas', type: 'error' });
    }
  };

  // Admin Quick Add Slot on this camera & date
  const handleQuickAddSlot = async () => {
    if (!selectedCell || !newSlotInspectorId) return;
    try {
      // Find template version (default to people counting ver-e-01-v3)
      await api.createTask({
        camera_id: selectedCell.camera.id,
        assigned_user_id: newSlotInspectorId,
        template_version_id: 'ver-e-01-v3',
        target_date: selectedCell.day.dateStr,
        target_time_slot: newSlotTime,
      });
      setToast({ text: `Slot jam ${newSlotTime} berhasil ditambahkan!`, type: 'success' });
      setShowAddSlotModal(false);
      await loadAllData();
    } catch (err: any) {
      setToast({ text: err.message || 'Gagal menambahkan slot', type: 'error' });
    }
  };

  return (
    <div className="page-wrapper">
      {/* HEADER */}
      <div className="page-header">
        <div className="page-title-group">
          <h2>Matriks Pemantauan Progress CCTV (Weekly Inspection Board)</h2>
          <p>Pantau ketercapaian inspeksi rekaman seluruh kamera CCTV per hari dan slot jam dalam siklus mingguan.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadAllData}>
            <RefreshCw size={16} /> Perbarui
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
            <CheckCircle2 size={13} color="#10b981" /> Tingkat Penyelesaian
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399' }}>{completionRate}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {doneWeekTasks} dari {totalWeekTasks} slot selesai
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} color="#f59e0b" /> Dalam Pengerjaan (Draft)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24' }}>{inProgressWeekTasks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Sedang diobservasi</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #f43f5e' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <AlertCircle size={13} color="#f43f5e" /> Belum Dikerjakan
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fca5a5' }}>{notStartedWeekTasks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Menunggu petugas</div>
        </div>

        <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #64748b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <EyeOff size={13} color="#94a3b8" /> Slot Blindspot (Tanpa Jadwal)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#cbd5e1' }}>{totalBlindspotSlots}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Titik belum terjadwal</div>
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

      {/* TWO-TIER CONTROLS: WEEK NAVIGATION & REFINED FILTER TOOLBAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Tier 1: Weekly Navigation Bar with Visual Legend */}
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
          {/* Week Navigation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}
              onClick={handlePrevWeek}
              title="Lihat Minggu Sebelumnya"
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
              title="Lihat Minggu Berikutnya"
            >
              Minggu Berikutnya <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 }}
              onClick={handleTodayWeek}
            >
              Minggu Ini
            </button>
          </div>

          {/* Quick Legend of Matrix Status Icons & Colors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.74rem' }}>
            <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>LEGENDA STATUS:</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
              <CheckCircle2 size={12} color="#10b981" /> Selesai (100%)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
              <Clock size={12} color="#f59e0b" /> In Progress
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f87171' }}>
              <AlertTriangle size={12} color="#f43f5e" /> Belum Mulai (0%)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
              <EyeOff size={12} color="#94a3b8" /> Blindspot (Tanpa Jadwal)
            </span>
          </div>
        </div>

        {/* Tier 2: Refined Filter Toolbar */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          {/* Filters: System, Status, NVR, Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
            {/* System Segmented Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              {(['ALL', 'InaAI', 'AEON'] as const).map((sys) => {
                const count = sys === 'ALL' ? cameras.length : cameras.filter((c) => c.system === sys).length;
                const isActive = systemFilter === sys;
                return (
                  <button
                    key={sys}
                    type="button"
                    style={{
                      background: isActive ? (sys === 'InaAI' ? '#0ea5e9' : sys === 'AEON' ? '#8b5cf6' : 'var(--primary)') : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setSystemFilter(sys)}
                  >
                    {sys === 'ALL' ? 'Semua Sistem' : sys} ({count})
                  </button>
                );
              })}
            </div>

            {/* Matrix Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="#38bdf8" />
              <select
                className="form-select"
                value={progressFilter}
                onChange={(e) => setProgressFilter(e.target.value as any)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: 'auto', minWidth: '170px' }}
              >
                <option value="ALL">Semua Kondisi Matriks</option>
                <option value="DONE">✓ Ada Slot Selesai (100%)</option>
                <option value="IN_PROGRESS">⏳ Sedang Dalam Pengerjaan</option>
                <option value="NOT_STARTED">⚠️ Ada Tugas Belum Mulai</option>
                <option value="BLINDSPOT">👁️ Area Blindspot (Ada Hari Kosong)</option>
                <option value="REVISION">🔄 Ada Permintaan Revisi</option>
              </select>
            </div>

            {/* NVR Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color="#818cf8" />
              <select
                className="form-select"
                value={nvrFilter}
                onChange={(e) => setNvrFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: 'auto', minWidth: '140px' }}
              >
                <option value="ALL">Semua NVR ({availableNvrs.length})</option>
                {availableNvrs.map((nvr) => (
                  <option key={nvr} value={nvr}>
                    {nvr}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kamera / lokasi..."
                style={{ padding: '0.4rem 2rem 0.4rem 2.2rem', fontSize: '0.8rem', width: '100%' }}
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

          {/* Right: Counter & Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Menampilkan <strong style={{ color: '#ffffff' }}>{filteredCameras.length}</strong> dari{' '}
              <strong>{cameras.length}</strong> kamera
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

      {/* MATRIX TABLE BOARD */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
              {/* Camera Column Header */}
              <th style={{ padding: '1rem', width: '280px', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 700 }}>
                TITIK KAMERA & NVR
              </th>

              {/* 7 Days Column Headers */}
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
                  <div style={{ fontSize: '0.78rem', color: d.isToday ? 'var(--accent-cyan)' : 'var(--text-dim)', textTransform: 'uppercase' }}>
                    {d.dayName}
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: d.isToday ? '#ffffff' : 'var(--text-main)' }}>
                    {d.displayDate}
                  </div>
                  {d.isToday && (
                    <span style={{ fontSize: '0.65rem', background: 'var(--accent-cyan)', color: '#000', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
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
                  Memuat data matriks progress CCTV...
                </td>
              </tr>
            ) : filteredCameras.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  Tidak ada kamera yang cocok dengan filter saat ini.
                </td>
              </tr>
            ) : (
              filteredCameras.map((cam) => (
                <tr key={cam.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {/* Camera Row Header */}
                  <td style={{ padding: '0.85rem 1rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
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
                      {cam.status === 'offline' && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            background: 'rgba(244, 63, 94, 0.18)',
                            color: '#fb7185',
                            border: '1px solid rgba(244, 63, 94, 0.4)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          title="Kamera offline (Blindspot)"
                        >
                          <EyeOff size={9} /> Blindspot
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: cam.status === 'online' ? '#10b981' : cam.status === 'offline' ? '#f43f5e' : '#f59e0b',
                          boxShadow:
                            cam.status === 'online'
                              ? '0 0 6px rgba(16, 185, 129, 0.7)'
                              : cam.status === 'offline'
                              ? '0 0 6px rgba(244, 63, 94, 0.7)'
                              : '0 0 6px rgba(245, 158, 11, 0.7)',
                          flexShrink: 0,
                        }}
                        title={`Status: ${cam.status}`}
                      />
                      <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.88rem' }}>{cam.name}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {cam.code}
                    </div>
                  </td>

                  {/* 7 Daily Cells for this camera */}
                  {weekDays.map((d) => {
                    const key = `${cam.id}_${d.dateStr}`;
                    const cellTasks = tasksByCamAndDate.get(key) || [];
                    const total = cellTasks.length;
                    const done = cellTasks.filter((t) => t.status === 'DONE').length;
                    const hasRevision = cellTasks.some((t) => t.status === 'REVISION_NEEDED');
                    const hasProgress = cellTasks.some((t) => t.status === 'IN_PROGRESS');

                    return (
                      <td
                        key={d.dateStr}
                        onClick={() => handleCellClick(cam, d)}
                        style={{
                          padding: '0.75rem 0.4rem',
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
                        title={`Klik untuk melihat detail ${cam.name} pada ${d.fullDateLabel}`}
                      >
                        {total === 0 ? (
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
                            <span>Blindspot</span>
                          </div>
                        ) : hasRevision ? (
                          <div
                            style={{
                              background: 'rgba(244, 63, 94, 0.16)',
                              border: '1px solid rgba(244, 63, 94, 0.4)',
                              color: '#fb7185',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              minWidth: '85px',
                              justifyContent: 'center',
                            }}
                          >
                            <RefreshCw size={11} />
                            <span>Revisi ({cellTasks.filter((t) => t.status === 'REVISION_NEEDED').length})</span>
                          </div>
                        ) : done === total ? (
                          <div
                            style={{
                              background: 'rgba(16, 185, 129, 0.16)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#34d399',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              minWidth: '85px',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckCircle2 size={12} color="#34d399" />
                            <span>{done}/{total} Selesai</span>
                          </div>
                        ) : done > 0 || hasProgress ? (
                          <div
                            style={{
                              background: 'rgba(245, 158, 11, 0.16)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#fbbf24',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              minWidth: '85px',
                              justifyContent: 'center',
                            }}
                          >
                            <Clock size={11} color="#fbbf24" />
                            <span>{done}/{total} Slot</span>
                          </div>
                        ) : (
                          <div
                            style={{
                              background: 'rgba(239, 68, 68, 0.16)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              color: '#f87171',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              minWidth: '85px',
                              justifyContent: 'center',
                            }}
                          >
                            <AlertTriangle size={11} color="#f87171" />
                            <span>0/{total} Mulai</span>
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

      {/* SLIDE-OVER RIGHT DRAWER (DETAIL INSPEKSI HARIAN) */}
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
              maxWidth: '560px',
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

            {/* Daily Progress Bar */}
            <div style={{ padding: '1rem 1.5rem', background: 'rgba(255, 255, 255, 0.01)', borderBottom: '1px solid var(--border-subtle)' }}>
              {(() => {
                const total = selectedCell.tasks.length;
                const done = selectedCell.tasks.filter((t) => t.status === 'DONE').length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Progress Pengecekan Hari Ini:</span>
                      <strong style={{ color: done === total && total > 0 ? '#34d399' : '#38bdf8' }}>
                        {done} dari {total} Slot Selesai ({pct}%)
                      </strong>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: done === total && total > 0 ? '#10b981' : 'linear-gradient(90deg, #0ea5e9, #8b5cf6)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Drawer Body: Tasks Timeline */}
            <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Daftar Slot Jam Pengamatan ({selectedCell.tasks.length})
                </h4>

                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                    onClick={() => setShowAddSlotModal(true)}
                  >
                    <Plus size={14} /> Tambah Slot Jam
                  </button>
                )}
              </div>

              {selectedCell.tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(244, 63, 94, 0.35)', borderRadius: '10px' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                    <EyeOff size={26} color="#fb7185" />
                  </div>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.98rem' }}>Titik Blindspot (Belum Ada Jadwal)</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '360px', margin: '6px auto 0', lineHeight: 1.5 }}>
                    Kamera ini belum memiliki penugasan observasi untuk tanggal <strong>{selectedCell.day.fullDateLabel}</strong>. Segera jadwalkan slot tugas agar tidak terjadi kekosongan pengawasan.
                  </p>
                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: '1rem', padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                      onClick={() => setShowAddSlotModal(true)}
                    >
                      <Plus size={14} /> Jadwalkan Tugas Sekarang
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {selectedCell.tasks.map((task, idx) => {
                    const record = recordsByTaskId.get(task.id);
                    const p = record?.payload || {};

                    return (
                      <div
                        key={task.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${
                            task.status === 'DONE'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : task.status === 'REVISION_NEEDED'
                              ? 'rgba(244, 63, 94, 0.3)'
                              : task.status === 'IN_PROGRESS'
                              ? 'rgba(245, 158, 11, 0.3)'
                              : 'var(--border-subtle)'
                          }`,
                          borderRadius: '8px',
                          padding: '1rem',
                        }}
                      >
                        {/* Task Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: 'rgba(255, 255, 255, 0.08)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              {idx + 1}
                            </span>
                            <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={13} color="#818cf8" /> {task.target_time_slot || 'Semua Jam'}
                            </div>
                          </div>

                          {/* Status badge */}
                          <div>
                            {task.status === 'DONE' && (
                              <span className="status-pill status-done" style={{ fontSize: '0.72rem' }}>
                                <CheckCircle2 size={12} /> Selesai
                              </span>
                            )}
                            {task.status === 'IN_PROGRESS' && (
                              <span className="status-pill status-in-progress" style={{ fontSize: '0.72rem' }}>
                                <Clock size={12} /> Draft
                              </span>
                            )}
                            {task.status === 'NOT_STARTED' && (
                              <span className="status-pill status-not-started" style={{ fontSize: '0.72rem' }}>
                                <AlertCircle size={12} /> Belum Mulai
                              </span>
                            )}
                            {task.status === 'REVISION_NEEDED' && (
                              <span className="status-pill status-revision" style={{ fontSize: '0.72rem' }}>
                                <AlertTriangle size={12} /> Revisi Diminta
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inspector Assigned */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <UserIcon size={13} color="var(--accent-cyan)" />
                            <span>Petugas: <strong style={{ color: 'var(--text-main)' }}>{task.assigned_user_name}</strong></span>
                          </div>

                          {currentUser.role === 'admin' && task.status !== 'DONE' && (
                            <button
                              type="button"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                              onClick={() => {
                                setReassigningTaskId(reassigningTaskId === task.id ? null : task.id);
                                setNewInspectorId(task.assigned_user_id);
                              }}
                            >
                              Ganti Petugas
                            </button>
                          )}
                        </div>

                        {/* Reassign inline dropdown */}
                        {reassigningTaskId === task.id && (
                          <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '0.65rem', marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                              Alihkan Tugas ke Petugas Lain:
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <select
                                className="form-select"
                                value={newInspectorId}
                                onChange={(e) => setNewInspectorId(e.target.value)}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                              >
                                {inspectors.map((ins) => (
                                  <option key={ins.id} value={ins.id}>
                                    {ins.name} ({ins.email})
                                  </option>
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

                        {/* Observational Payload Box if task is DONE */}
                        {task.status === 'DONE' && record && (
                          <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              📊 Hasil Observasi Visual (Formulir {record.template_name || 'Penghitungan Orang'}):
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.8rem', marginBottom: '6px' }}>
                              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '5px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Laki-laki:</span> <strong>{p.male_count ?? 0}</strong>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '5px 8px', borderRadius: '4px' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Perempuan:</span> <strong>{p.female_count ?? 0}</strong>
                              </div>
                              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '5px 8px', borderRadius: '4px', gridColumn: 'span 2' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Total Terhitung:</span> <strong style={{ color: '#34d399' }}>{p.total_people ?? 0} Orang</strong>
                              </div>
                            </div>

                            {p.density_level && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                <strong>Kepadatan:</strong> {p.density_level}
                              </div>
                            )}

                            {record.notes && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '4px' }}>
                                "{record.notes}"
                              </div>
                            )}

                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '4px' }}>
                              Disubmit pada: {new Date(record.submitted_at).toLocaleString('id-ID')}
                            </div>

                            {/* Supervisor Review Status & Action Box */}
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Status Verifikasi Supervisor:</span>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background:
                                      record.review_status === 'APPROVED'
                                        ? 'rgba(16, 185, 129, 0.15)'
                                        : record.review_status === 'REVISION_REQUESTED'
                                        ? 'rgba(244, 63, 94, 0.15)'
                                        : 'rgba(245, 158, 11, 0.15)',
                                    color:
                                      record.review_status === 'APPROVED'
                                        ? '#34d399'
                                        : record.review_status === 'REVISION_REQUESTED'
                                        ? '#fb7185'
                                        : '#fbbf24',
                                  }}
                                >
                                  {record.review_status === 'APPROVED'
                                    ? '✓ DISETUJUI (APPROVED)'
                                    : record.review_status === 'REVISION_REQUESTED'
                                    ? '🔄 REVISI DIMINTA'
                                    : '⏳ MENUNGGU VERIFIKASI'}
                                </span>
                              </div>

                              {/* Supervisor Review Buttons */}
                              {currentUser.role === 'supervisor' && (
                                <div style={{ marginTop: '0.65rem' }}>
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
                                      <label style={{ fontSize: '0.75rem', color: '#fb7185', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                                        Catatan Revisi untuk Petugas:
                                      </label>
                                      <textarea
                                        className="form-input"
                                        rows={2}
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        placeholder="Contoh: Tolong hitung ulang bagian perempuan di menit ke-15..."
                                        style={{ fontSize: '0.8rem', marginBottom: '6px' }}
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
                          </div>
                        )}

                        {/* Admin Action: Delete this slot if not started */}
                        {currentUser.role === 'admin' && task.status !== 'DONE' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fb7185',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              onClick={() => handleDeleteTask(task.id)}
                            >
                              <Trash2 size={12} /> Batalkan Slot Ini
                            </button>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {selectedCell.camera.code} · {selectedCell.day.dateStr}
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedCell(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD SLOT MODAL (FOR ADMIN) */}
      {showAddSlotModal && selectedCell && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={16} color="var(--accent-cyan)" />
                Tambah Slot Jam: {selectedCell.camera.name}
              </h3>
              <button type="button" onClick={() => setShowAddSlotModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div style={{ padding: '0.75rem', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                <div><strong>Kamera:</strong> {selectedCell.camera.name} ({selectedCell.camera.code})</div>
                <div><strong>Tanggal:</strong> {selectedCell.day.fullDateLabel}</div>
              </div>

              <div className="form-group">
                <label className="form-label">Pilih Slot Jam Pengamatan *</label>
                <select
                  className="form-select"
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                >
                  {[
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
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tugaskan Kepada Petugas *</label>
                <select
                  className="form-select"
                  value={newSlotInspectorId}
                  onChange={(e) => setNewSlotInspectorId(e.target.value)}
                >
                  {inspectors.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.name} ({ins.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddSlotModal(false)}>
                Batal
              </button>
              <button type="button" className="btn btn-primary" onClick={handleQuickAddSlot}>
                Tambahkan Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
