import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  Eye, 
  Save, 
  Send, 
  X, 
  RefreshCw, 
  Calendar, 
  Users, 
  Activity, 
  Check, 
  Plus, 
  Minus, 
  FileText,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { InspectionTask, User, SampleItem } from '../types';

interface InspectorTaskViewProps {
  currentUser: User | null;
}

const DEFAULT_ACTIONS = [
  'Melihat Produk / Rak (Browsing)',
  'Mengambil Barang (Pick)',
  'Mengembalikan Barang',
  'Melintas Cepat (Walk-by)',
  'Interaksi Staff / SPG',
  'Antre / Transaksi Kasir',
];

const AGE_CATEGORIES = [
  'Anak-anak (< 15 thn)',
  'Remaja (15 - 24 thn)',
  'Dewasa (25 - 50 thn)',
  'Lansia (> 50 thn)',
];

const createEmptySample = (num: number): SampleItem => ({
  sample_number: num,
  is_completed: false,
  traffic: 0,
  actions: [],
  dominant_age: 'Dewasa (25 - 50 thn)',
  male_count: 0,
  female_count: 0,
  notes: '',
});

export const InspectorTaskView: React.FC<InspectorTaskViewProps> = ({ currentUser }) => {
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Inspection Modal State
  const [activeTask, setActiveTask] = useState<InspectionTask | null>(null);
  const [samples, setSamples] = useState<SampleItem[]>([
    createEmptySample(1),
    createEmptySample(2),
    createEmptySample(3),
  ]);
  const [activeSampleTab, setActiveSampleTab] = useState<number>(1);
  const [customActionInput, setCustomActionInput] = useState<string>('');
  const [evaluationNotes, setEvaluationNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadTasks();
  }, [currentUser]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      // Backend automatically filters by current user if inspector
      const data = await api.getTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat tugas inspeksi');
    } finally {
      setLoading(false);
    }
  };

  const openInspection = async (taskId: string) => {
    try {
      setSubmitting(true);
      setSubmitMessage(null);
      const detail = await api.getTask(taskId);
      setActiveTask(detail);

      // Parse draft or initialize 3 samples
      const draft = detail.draft_data;
      if (draft && Array.isArray(draft.samples) && draft.samples.length > 0) {
        // Ensure 3 samples
        const loadedSamples: SampleItem[] = draft.samples.map((s: any, idx: number) => ({
          sample_number: s.sample_number || idx + 1,
          is_completed: Boolean(s.is_completed),
          traffic: Number(s.traffic) || 0,
          actions: Array.isArray(s.actions) ? s.actions : [],
          dominant_age: s.dominant_age || 'Dewasa (25 - 50 thn)',
          male_count: Number(s.male_count) || 0,
          female_count: Number(s.female_count) || 0,
          notes: s.notes || '',
        }));
        while (loadedSamples.length < 3) {
          loadedSamples.push(createEmptySample(loadedSamples.length + 1));
        }
        setSamples(loadedSamples);
        setEvaluationNotes(draft.notes || '');
      } else {
        setSamples([createEmptySample(1), createEmptySample(2), createEmptySample(3)]);
        setEvaluationNotes('');
      }
      setActiveSampleTab(1);
    } catch (err: any) {
      setError(err.message || 'Gagal membuka detail evaluasi');
    } finally {
      setSubmitting(false);
    }
  };

  const updateSampleField = (sampleNumber: number, field: keyof SampleItem, value: any) => {
    setSamples((prev) =>
      prev.map((s) => {
        if (s.sample_number !== sampleNumber) return s;
        const updated = { ...s, [field]: value };
        
        // Auto synchronize traffic with male + female if traffic is 0 and genders entered
        if ((field === 'male_count' || field === 'female_count') && updated.traffic === 0) {
          updated.traffic = (updated.male_count || 0) + (updated.female_count || 0);
        }
        return updated;
      })
    );
  };

  const toggleAction = (sampleNumber: number, actionName: string) => {
    setSamples((prev) =>
      prev.map((s) => {
        if (s.sample_number !== sampleNumber) return s;
        const exists = s.actions.includes(actionName);
        const newActions = exists ? s.actions.filter((a) => a !== actionName) : [...s.actions, actionName];
        return { ...s, actions: newActions };
      })
    );
  };

  const addCustomAction = (sampleNumber: number) => {
    if (!customActionInput.trim()) return;
    const act = customActionInput.trim();
    setSamples((prev) =>
      prev.map((s) => {
        if (s.sample_number !== sampleNumber) return s;
        if (s.actions.includes(act)) return s;
        return { ...s, actions: [...s.actions, act] };
      })
    );
    setCustomActionInput('');
  };

  const toggleSampleChecklist = (sampleNumber: number) => {
    setSamples((prev) =>
      prev.map((s) => {
        if (s.sample_number !== sampleNumber) return s;
        return { ...s, is_completed: !s.is_completed };
      })
    );
  };

  // Aggregated totals
  const totalTraffic = samples.reduce((acc, s) => acc + (Number(s.traffic) || 0), 0);
  const totalMales = samples.reduce((acc, s) => acc + (Number(s.male_count) || 0), 0);
  const totalFemales = samples.reduce((acc, s) => acc + (Number(s.female_count) || 0), 0);
  const completedSamplesCount = samples.filter((s) => s.is_completed).length;

  const handleSaveDraft = async () => {
    if (!activeTask) return;
    try {
      setSubmitting(true);
      const payloadDraft = {
        samples,
        total_traffic: totalTraffic,
        total_people: totalTraffic,
        male_count: totalMales,
        female_count: totalFemales,
        notes: evaluationNotes,
      };
      await api.saveDraft(activeTask.id, payloadDraft);
      setActiveTask({ ...activeTask, status: 'IN_PROGRESS', draft_data: payloadDraft });
      await loadTasks();
      setSubmitMessage({ text: 'Draft evaluasi 3 sample berhasil disimpan! Anda dapat melanjutkannya kapan saja.', type: 'success' });
    } catch (err: any) {
      setSubmitMessage({ text: err.message || 'Gagal menyimpan draft', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeTask) return;

    // Check if at least 1 sample is checked off or filled
    const hasAnyChecked = samples.some((s) => s.is_completed);
    if (!hasAnyChecked) {
      if (!window.confirm('Belum ada sample yang diceklis selesai. Yakin ingin mengirimkan evaluasi sekarang?')) {
        return;
      }
    }

    try {
      setSubmitting(true);
      setSubmitMessage(null);

      const allActions = Array.from(new Set(samples.flatMap((s) => s.actions)));
      const finalPayload = {
        samples,
        total_traffic: totalTraffic,
        total_people: totalTraffic,
        male_count: totalMales,
        female_count: totalFemales,
        all_actions: allActions,
        notes: evaluationNotes,
      };

      await api.submitTask(activeTask.id, finalPayload, evaluationNotes);
      setActiveTask(null);
      await loadTasks();
      alert(`Evaluasi kamera ${activeTask.camera_name} (3 Sample) berhasil dikirim!`);
    } catch (err: any) {
      setSubmitMessage({ text: err.message || 'Gagal mengirim evaluasi', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  const curSample = samples.find((s) => s.sample_number === activeSampleTab) || samples[0];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Tugas Evaluasi Saya</h2>
          <p>
            Petugas: <strong>{currentUser?.name}</strong> · Periksa 3 sample pada masing-masing kamera CCTV yang ditugaskan ke Anda. 
            Catat <strong>Traffic (Jumlah Orang), Actions, Age, dan Gender</strong>, lalu ceklis jika sample telah selesai diperiksa.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadTasks}>
            <RefreshCw size={16} /> Perbarui Tugas
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', marginBottom: '1.5rem', color: '#fb7185' }}>
          {error}
        </div>
      )}

      {/* FILTER TABS */}
      <div className="filter-bar" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `Semua Kamera (${tasks.length})` },
            { id: 'NOT_STARTED', label: `Belum Mulai (${tasks.filter((t) => t.status === 'NOT_STARTED').length})` },
            { id: 'IN_PROGRESS', label: `Sedang Dikerjakan (${tasks.filter((t) => t.status === 'IN_PROGRESS').length})` },
            { id: 'DONE', label: `Selesai (${tasks.filter((t) => t.status === 'DONE').length})` },
            { id: 'REVISION_NEEDED', label: `Revisi (${tasks.filter((t) => t.status === 'REVISION_NEEDED').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn ${filterStatus === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TASK CARDS GRID */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 10px', display: 'block' }} />
          Memuat daftar kamera yang ditugaskan...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
          <CheckCircle2 size={36} color="var(--accent-cyan)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <h3>Tidak Ada Tugas pada Kategori Ini</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
            {filterStatus === 'ALL'
              ? 'Anda belum memiliki kamera yang ditugaskan. Hubungi Administrator untuk penugasan kamera.'
              : 'Semua tugas pada filter ini telah terselesaikan atau tidak ditemukan.'}
          </p>
        </div>
      ) : (
        <div className="task-grid">
          {filteredTasks.map((task) => {
            const draftSamples = task.draft_data?.samples;
            const completedCount = Array.isArray(draftSamples) ? draftSamples.filter((s: any) => s.is_completed).length : (task.status === 'DONE' ? 3 : 0);

            return (
              <div key={task.id} className="card task-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: task.camera_system === 'InaAI' ? 'rgba(14, 165, 233, 0.18)' : 'rgba(139, 92, 246, 0.18)',
                        color: task.camera_system === 'InaAI' ? '#38bdf8' : '#c084fc',
                        border: `1px solid ${task.camera_system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                      }}>
                        {task.camera_system || 'InaAI'}
                      </span>
                      {task.camera_nvr && (
                        <span style={{ fontSize: '0.72rem', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                          {task.camera_nvr} (Ch {task.camera_channel_no || 1})
                        </span>
                      )}
                    </div>

                    {task.status === 'DONE' && (
                      <span className="status-pill status-done"><CheckCircle2 size={12} /> Selesai</span>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <span className="status-pill status-in-progress"><Clock size={12} /> {completedCount}/3 Sample</span>
                    )}
                    {task.status === 'NOT_STARTED' && (
                      <span className="status-pill status-not-started"><AlertCircle size={12} /> Belum Mulai</span>
                    )}
                    {task.status === 'REVISION_NEEDED' && (
                      <span className="status-pill status-revision"><AlertTriangle size={12} /> Revisi</span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                    {task.camera_name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
                    {task.camera_code}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      background: 'rgba(56, 189, 248, 0.1)', 
                      color: '#38bdf8', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600 
                    }}>
                      <Calendar size={11} /> {task.target_date || 'Hari Ini'}
                    </span>

                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      background: completedCount === 3 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                      color: completedCount === 3 ? '#34d399' : 'var(--text-dim)', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <CheckCircle2 size={11} color={completedCount === 3 ? '#34d399' : '#94a3b8'} /> 
                      {completedCount}/3 Sample Diceklis
                    </span>
                  </div>

                  {task.status === 'REVISION_NEEDED' && (
                    <div style={{ padding: '0.65rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', fontSize: '0.75rem', color: '#fb7185', marginBottom: '0.75rem' }}>
                      <strong>Pemeriksaan Ulang:</strong> Supervisor meminta pengecekan ulang sample kamera ini.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Target: 3 Sample
                  </span>
                  <button
                    className={`btn ${task.status === 'DONE' ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                    onClick={() => openInspection(task.id)}
                  >
                    {task.status === 'DONE' ? (
                      <>
                        <Eye size={14} /> Lihat Evaluasi
                      </>
                    ) : (
                      <>
                        <Camera size={14} /> {task.status === 'IN_PROGRESS' ? 'Lanjutkan Evaluasi' : 'Mulai Evaluasi'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INSPECTION WORKBENCH MODAL (3 SAMPLES EVALUATION) */}
      {activeTask && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '1050px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera size={20} color="#38bdf8" />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                    Evaluasi: {activeTask.camera_name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {activeTask.camera_code} · {activeTask.camera_system} · Tanggal: <strong style={{ color: '#38bdf8' }}>{activeTask.target_date || 'Hari Ini'}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  background: completedSamplesCount === 3 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: completedSamplesCount === 3 ? '#34d399' : '#fbbf24',
                  border: `1px solid ${completedSamplesCount === 3 ? '#10b981' : '#f59e0b'}`,
                }}>
                  {completedSamplesCount} / 3 Sample Selesai Diceklis
                </span>
                <button
                  onClick={() => setActiveTask(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '1.25rem' }}>
              {submitMessage && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  background: submitMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  border: `1px solid ${submitMessage.type === 'success' ? '#10b981' : '#f43f5e'}`,
                  color: submitMessage.type === 'success' ? '#34d399' : '#fb7185',
                }}>
                  {submitMessage.text}
                </div>
              )}

              {/* Sample Tabs: Sample 1, Sample 2, Sample 3 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
                {[1, 2, 3].map((num) => {
                  const s = samples.find((item) => item.sample_number === num);
                  const isDone = s?.is_completed;
                  const isActive = activeSampleTab === num;

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setActiveSampleTab(num)}
                      style={{
                        padding: '0.55rem 1.25rem',
                        borderRadius: '8px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: isActive ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: isActive ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                        color: isActive ? '#38bdf8' : 'var(--text-dim)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>Sample {num}</span>
                      {isDone ? (
                        <span style={{ background: '#10b981', color: '#000', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                          ✓
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                          (Belum Ceklis)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ACTIVE SAMPLE EDITOR */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1.25rem' }}>
                {/* Sample Header & Checklist Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                      Observasi Sample {curSample.sample_number}
                    </h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                      Periksa rekaman pada titik sample ini dan isikan temuan traffic, actions, age, serta gender.
                    </span>
                  </div>

                  {/* Checklist Button */}
                  <button
                    type="button"
                    onClick={() => toggleSampleChecklist(curSample.sample_number)}
                    disabled={activeTask.status === 'DONE'}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: activeTask.status === 'DONE' ? 'not-allowed' : 'pointer',
                      border: curSample.is_completed ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)',
                      background: curSample.is_completed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: curSample.is_completed ? '#34d399' : 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: curSample.is_completed ? '1px solid #10b981' : '1px solid var(--text-dim)',
                      background: curSample.is_completed ? '#10b981' : 'transparent',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                    }}>
                      {curSample.is_completed ? '✓' : ''}
                    </div>
                    <span>{curSample.is_completed ? '✓ Sample Ini Selesai Dicek' : 'Klik untuk Ceklis Selesai Sample'}</span>
                  </button>
                </div>

                {/* 1. TRAFFIC / JUMLAH ORANG */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.88rem' }}>
                    <Users size={16} /> 1. Traffic / Jumlah Orang yang Teramati
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="number"
                      className="form-input"
                      min={0}
                      disabled={activeTask.status === 'DONE'}
                      value={curSample.traffic}
                      onChange={(e) => updateSampleField(curSample.sample_number, 'traffic', Math.max(0, parseInt(e.target.value) || 0))}
                      style={{ maxWidth: '160px', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={activeTask.status === 'DONE'}
                        onClick={() => updateSampleField(curSample.sample_number, 'traffic', Math.max(0, curSample.traffic - 1))}
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={activeTask.status === 'DONE'}
                        onClick={() => updateSampleField(curSample.sample_number, 'traffic', curSample.traffic + 1)}
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={activeTask.status === 'DONE'}
                        onClick={() => updateSampleField(curSample.sample_number, 'traffic', curSample.traffic + 5)}
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        +5
                      </button>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>orang terlihat pada sample ini</span>
                  </div>
                </div>

                {/* 2. ACTIONS / AKTIVITAS */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7', fontSize: '0.88rem' }}>
                    <Activity size={16} /> 2. Actions (Aktivitas / Tindakan yang Teramati)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '0.65rem' }}>
                    {DEFAULT_ACTIONS.map((act) => {
                      const isSelected = curSample.actions.includes(act);
                      return (
                        <button
                          key={act}
                          type="button"
                          disabled={activeTask.status === 'DONE'}
                          onClick={() => toggleAction(curSample.sample_number, act)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: activeTask.status === 'DONE' ? 'not-allowed' : 'pointer',
                            border: isSelected ? '1px solid #a855f7' : '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                            color: isSelected ? '#d8b4fe' : 'var(--text-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected && <Check size={13} color="#d8b4fe" />}
                          <span>{act}</span>
                        </button>
                      );
                    })}

                    {/* Custom added actions */}
                    {curSample.actions
                      .filter((a) => !DEFAULT_ACTIONS.includes(a))
                      .map((act) => (
                        <button
                          key={act}
                          type="button"
                          disabled={activeTask.status === 'DONE'}
                          onClick={() => toggleAction(curSample.sample_number, act)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            border: '1px solid #38bdf8',
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Check size={13} color="#38bdf8" />
                          <span>{act}</span>
                        </button>
                      ))}
                  </div>

                  {activeTask.status !== 'DONE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '380px' }}>
                      <input
                        className="form-input"
                        placeholder="Tambah aktivitas lain..."
                        value={customActionInput}
                        onChange={(e) => setCustomActionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomAction(curSample.sample_number);
                          }
                        }}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => addCustomAction(curSample.sample_number)}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        + Tambah
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. AGE (KATEGORI USIA) & 4. GENDER (JENIS KELAMIN) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  {/* Age */}
                  <div>
                    <label className="form-label" style={{ color: '#fbbf24', fontSize: '0.88rem' }}>
                      3. Age (Kategori Usia Dominan)
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {AGE_CATEGORIES.map((age) => {
                        const isSelected = curSample.dominant_age === age;
                        return (
                          <button
                            key={age}
                            type="button"
                            disabled={activeTask.status === 'DONE'}
                            onClick={() => updateSampleField(curSample.sample_number, 'dominant_age', age)}
                            style={{
                              padding: '0.4rem 0.8rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: activeTask.status === 'DONE' ? 'not-allowed' : 'pointer',
                              border: isSelected ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
                              background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                              color: isSelected ? '#fbbf24' : 'var(--text-dim)',
                            }}
                          >
                            {age}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gender Breakdown */}
                  <div>
                    <label className="form-label" style={{ color: '#34d399', fontSize: '0.88rem' }}>
                      4. Gender (Jenis Kelamin Teramati)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#93c5fd', display: 'block', marginBottom: '4px' }}>
                          Pria (Male)
                        </span>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          disabled={activeTask.status === 'DONE'}
                          value={curSample.male_count}
                          onChange={(e) => updateSampleField(curSample.sample_number, 'male_count', Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          style={{ textAlign: 'center', fontWeight: 600 }}
                        />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#f472b6', display: 'block', marginBottom: '4px' }}>
                          Wanita (Female)
                        </span>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          disabled={activeTask.status === 'DONE'}
                          value={curSample.female_count}
                          onChange={(e) => updateSampleField(curSample.sample_number, 'female_count', Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          style={{ textAlign: 'center', fontWeight: 600 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catatan Sample */}
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Catatan Khusus Sample {curSample.sample_number} (Opsional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    disabled={activeTask.status === 'DONE'}
                    value={curSample.notes || ''}
                    onChange={(e) => updateSampleField(curSample.sample_number, 'notes', e.target.value)}
                    placeholder="Misal: Pengunjung ramai di menit ke-15, antrean tertib..."
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              {/* OVERALL CAMERA EVALUATION SUMMARY */}
              <div style={{ marginTop: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                  📊 Rekap Keseluruhan 3 Sample pada Kamera Ini:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Total Traffic (Orang):</span>{' '}
                    <strong style={{ color: '#38bdf8' }}>{totalTraffic} Orang</strong>
                  </div>
                  <div style={{ background: 'rgba(52, 211, 153, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Pria / Wanita:</span>{' '}
                    <strong style={{ color: '#34d399' }}>{totalMales} Pria / {totalFemales} Wanita</strong>
                  </div>
                  <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '8px 12px', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Sample Diceklis:</span>{' '}
                    <strong style={{ color: completedSamplesCount === 3 ? '#34d399' : '#fbbf24' }}>
                      {completedSamplesCount} / 3 Selesai
                    </strong>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
                    Catatan Akhir Evaluasi Kamera (Opsional):
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    disabled={activeTask.status === 'DONE'}
                    value={evaluationNotes}
                    onChange={(e) => setEvaluationNotes(e.target.value)}
                    placeholder="Catatan umum kondisi kamera atau perilaku pengunjung secara umum..."
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setActiveTask(null)}>
                Tutup
              </button>

              {activeTask.status !== 'DONE' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleSaveDraft}
                    disabled={submitting}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={15} /> Simpan Draft
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}
                  >
                    <Send size={15} /> {submitting ? 'Mengirim...' : 'Kirim Evaluasi Selesai'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
