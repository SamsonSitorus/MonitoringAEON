import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Eye, 
  Save, 
  Send, 
  X, 
  Maximize2,
  RefreshCw,
  Sparkles,
  Calendar,
  Lock,
  Server,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { InspectionTask, User, FormField } from '../types';

interface InspectorTaskViewProps {
  currentUser: User | null;
}

export const InspectorTaskView: React.FC<InspectorTaskViewProps> = ({ currentUser }) => {
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Inspection Modal State
  const [activeTask, setActiveTask] = useState<InspectionTask | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live timer for camera simulator
  const [liveTimestamp, setLiveTimestamp] = useState<string>('');

  useEffect(() => {
    loadTasks();
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setLiveTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + ' WIB');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      setSubmitError(null);
      const detail = await api.getTask(taskId);
      setActiveTask(detail);

      // Load draft data if exists
      if (detail.draft_data && Object.keys(detail.draft_data).length > 0) {
        const draft = { ...detail.draft_data };
        // If task has designated target_time_slot, strictly use it
        if (detail.target_time_slot) {
          draft.observation_time_slot = detail.target_time_slot;
        } else {
          // Auto-select current hour slot if not yet filled
          const timeSlotField = detail.schema?.fields?.find((f: FormField) => f.key === 'observation_time_slot');
          if (timeSlotField && !draft.observation_time_slot && timeSlotField.options && timeSlotField.options.length > 0) {
            const curH = new Date().getHours();
            const hourPrefix = String(curH).padStart(2, '0') + ':00';
            const matched = timeSlotField.options.find((opt: string) => opt.startsWith(hourPrefix));
            draft.observation_time_slot = matched || timeSlotField.options[0];
          }
        }
        setFormData(draft);
      } else {
        // Initialize default values
        const initVals: Record<string, any> = {};
        if (detail.schema?.fields) {
          for (const f of detail.schema.fields) {
            if (f.default_value !== undefined) {
              initVals[f.key] = f.default_value;
            } else if (f.key === 'observation_time_slot') {
              if (detail.target_time_slot) {
                initVals[f.key] = detail.target_time_slot;
              } else if (f.options && f.options.length > 0) {
                const curH = new Date().getHours();
                const hourPrefix = String(curH).padStart(2, '0') + ':00';
                const matched = f.options.find((opt: string) => opt.startsWith(hourPrefix));
                initVals[f.key] = matched || f.options[0];
              }
            }
          }
        }
        setFormData(initVals);
      }
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'Gagal membuka detail tugas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...formData, [key]: value };
    setFormData(updated);
  };

  // Safe formula calculation
  const computeFormula = (formula: string, values: Record<string, any>) => {
    try {
      let expression = formula;
      const matches = formula.match(/\{([^}]+)\}/g);
      if (matches) {
        for (const m of matches) {
          const key = m.replace('{', '').replace('}', '').trim();
          const val = Number(values[key]) || 0;
          expression = expression.replaceAll(m, val.toString());
        }
      }
      if (/^[0-9+\-*/().\s]+$/.test(expression)) {
        // eslint-disable-next-line no-eval
        return Function(`'use strict'; return (${expression})`)();
      }
      return 0;
    } catch {
      return 0;
    }
  };

  const handleSaveDraft = async () => {
    if (!activeTask) return;
    try {
      setSubmitting(true);
      const draft = { ...formData };
      if (activeTask.target_time_slot) {
        draft.observation_time_slot = activeTask.target_time_slot;
      }
      await api.saveDraft(activeTask.id, draft);
      setActiveTask({ ...activeTask, status: 'IN_PROGRESS' });
      await loadTasks();
      alert('Draft berhasil disimpan! Anda dapat melanjutkannya nanti.');
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menyimpan draft');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!activeTask) return;
    try {
      setSubmitting(true);
      setSubmitError(null);

      // Auto-compute formula values into final payload
      const finalPayload = { ...formData };
      if (activeTask.target_time_slot) {
        finalPayload.observation_time_slot = activeTask.target_time_slot;
      }

      if (activeTask.schema?.fields) {
        for (const f of activeTask.schema.fields) {
          if (f.type === 'formula' && f.formula) {
            finalPayload[f.key] = computeFormula(f.formula, formData);
          }
        }
      }

      await api.submitTask(activeTask.id, finalPayload, notes);
      setActiveTask(null);
      await loadTasks();
      alert(`Observasi kamera untuk slot ${activeTask.target_time_slot || 'waktu saat ini'} berhasil dikirim!`);
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal mengirim hasil inspeksi');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DONE':
        return <span className="status-pill status-done"><CheckCircle2 size={13} /> Selesai (Done)</span>;
      case 'IN_PROGRESS':
        return <span className="status-pill status-in-progress"><Clock size={13} /> Sedang Dikerjakan</span>;
      case 'REVISION_NEEDED':
        return <span className="status-pill status-revision"><AlertTriangle size={13} /> Perlu Revisi</span>;
      default:
        return <span className="status-pill status-not-started"><AlertCircle size={13} /> Belum Mulai</span>;
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Tugas Observasi Kamera Saya</h2>
          <p>
            Petugas: <strong>{currentUser?.name}</strong> · Selesaikan observasi visual sesuai template dinamis yang ditentukan.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadTasks}>
            <RefreshCw size={16} /> Perbarui Antrean
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', marginBottom: '1.5rem', color: '#fb7185' }}>
          {error}
        </div>
      )}

      {/* FILTER TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        {[
          { key: 'ALL', label: `Semua Tugas (${tasks.length})` },
          { key: 'NOT_STARTED', label: `Belum Mulai (${tasks.filter(t => t.status === 'NOT_STARTED').length})` },
          { key: 'IN_PROGRESS', label: `Dalam Progres (${tasks.filter(t => t.status === 'IN_PROGRESS').length})` },
          { key: 'REVISION_NEEDED', label: `Perlu Revisi (${tasks.filter(t => t.status === 'REVISION_NEEDED').length})` },
          { key: 'DONE', label: `Selesai (${tasks.filter(t => t.status === 'DONE').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            style={{
              background: filterStatus === tab.key ? 'var(--bg-card-hover)' : 'transparent',
              border: `1px solid ${filterStatus === tab.key ? 'var(--accent-cyan)' : 'transparent'}`,
              color: filterStatus === tab.key ? 'var(--accent-cyan)' : 'var(--text-muted)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TASK CARDS GRID */}
      {filteredTasks.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
          <CheckCircle2 size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3>Tidak ada tugas di kategori ini</h3>
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Semua penugasan kamera telah diperiksa atau belum ada tugas baru.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${task.camera_system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
              }}
            >
              <div>
                {/* Header: System, NVR, Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: task.camera_system === 'InaAI' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        border: `1px solid ${task.camera_system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                        color: task.camera_system === 'InaAI' ? '#38bdf8' : '#c084fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Layers size={11} /> {task.camera_system || 'InaAI'}
                    </span>
                    {task.camera_nvr && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: '#a5b4fc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Server size={11} /> {task.camera_nvr} (Ch {task.camera_channel_no || 1})
                      </span>
                    )}
                  </div>
                  {getStatusBadge(task.status)}
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700, marginBottom: '2px' }}>
                  {task.camera_code}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem' }}>{task.camera_name}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Form:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{task.template_name} (v{task.version_number})</strong>
                </div>

                  {/* Badges for Target Date & Target Time Slot */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {task.target_date && (
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
                        <Calendar size={11} /> {task.target_date}
                      </span>
                    )}
                    {task.target_time_slot && (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        background: 'rgba(99, 102, 241, 0.15)', 
                        border: '1px solid rgba(99, 102, 241, 0.3)', 
                        color: '#a5b4fc', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600 
                      }}>
                        <Clock size={11} color="#818cf8" /> {task.target_time_slot}
                      </span>
                    )}
                  </div>

                  {task.status === 'REVISION_NEEDED' && (
                    <div style={{ padding: '0.65rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', fontSize: '0.75rem', color: '#fb7185', marginBottom: '0.75rem' }}>
                      <strong>Pemeriksaan Ulang:</strong> Supervisor meminta pengecekan ulang data ini.
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    ID: {task.id}
                  </span>
                  <button
                    className={`btn ${task.status === 'DONE' ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                    onClick={() => openInspection(task.id)}
                  >
                    {task.status === 'DONE' ? (
                      <>
                        <Eye size={14} /> Lihat Hasil
                      </>
                    ) : (
                      <>
                        <Camera size={14} /> Mulai Observasi
                      </>
                    )}
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* INSPECTION MODAL / WORKBENCH */}
      {activeTask && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '1150px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera size={20} color="#38bdf8" />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    Observasi: {activeTask.camera_name} ({activeTask.camera_code})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Form Template: <strong>{activeTask.template_name}</strong> · Versi v{activeTask.version_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTask(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {submitError && (
                <div style={{ padding: '0.75rem', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fb7185', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {submitError}
                </div>
              )}

              <div className="split-inspection-layout">
                {/* LEFT: CCTV PLAYBACK INSTRUCTION & CONSOLE */}
                <div>
                  <div
                    style={{
                      background: '#0a0f1d',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingBottom: '0.65rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.78rem',
                          color: '#38bdf8',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        <div className="camera-rec-dot" />
                        CCTV TARGET REPLAY FEED
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {liveTimestamp}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', fontSize: '0.82rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '4px',
                        }}
                      >
                        <span style={{ color: 'var(--text-dim)' }}>Sistem Platform:</span>
                        <strong style={{ color: activeTask.camera_system === 'InaAI' ? '#38bdf8' : '#c084fc' }}>
                          {activeTask.camera_system || 'InaAI'}
                        </strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: '4px',
                        }}
                      >
                        <span style={{ color: 'var(--text-dim)' }}>Target NVR Server:</span>
                        <strong style={{ color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                          {activeTask.camera_nvr || 'NVR1.10.1.6.3'} (Ch. {activeTask.camera_channel_no || 1})
                        </strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          borderRadius: '4px',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                        }}
                      >
                        <span style={{ color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> Tanggal Rekaman:
                        </span>
                        <strong style={{ color: '#ffffff' }}>{activeTask.target_date || 'Hari Ini'}</strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'rgba(99, 102, 241, 0.08)',
                          borderRadius: '4px',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                        }}
                      >
                        <span style={{ color: '#818cf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Slot Jam Observasi:
                        </span>
                        <strong style={{ color: '#ffffff' }}>{activeTask.target_time_slot || 'Semua Jam'}</strong>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.85rem',
                      padding: '0.85rem',
                      background: 'var(--bg-card-subtle)',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <strong>Titik Kamera:</strong> {activeTask.camera_code} · {activeTask.camera_name}
                    </div>
                    <div style={{ marginTop: '3px', color: '#a5b4fc', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      <strong>NVR / Channel:</strong> {activeTask.camera_nvr || '-'} (Port Ch. {activeTask.camera_channel_no || 1})
                    </div>
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-dim)',
                        fontSize: '0.78rem',
                        lineHeight: '1.4',
                      }}
                    >
                      <strong>Instruksi Petugas:</strong> Buka software VMS / NVR <strong>{activeTask.camera_nvr || 'terkait'}</strong>, putar rekaman kamera <strong>{activeTask.camera_code}</strong> tanggal <strong>{activeTask.target_date || 'terkait'}</strong> pada pukul <strong>{activeTask.target_time_slot || 'yang ditentukan'}</strong>, lalu inputkan hasil pengamatan visual di formulir sebelah kanan.
                    </div>
                  </div>
                </div>

                {/* RIGHT: DYNAMIC FORM RENDERER */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '550px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Formulir Pengamatan Visual</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{activeTask.schema?.description}</p>
                  </div>

                  {activeTask.schema?.fields?.map((field: FormField) => {
                    // Check conditional visibility rule
                    if (field.show_if) {
                      const conditionVal = formData[field.show_if.field_key];
                      if (conditionVal !== field.show_if.value) {
                        return null; // Don't show field
                      }
                    }

                    // Formula calculated field
                    if (field.type === 'formula') {
                      const computed = computeFormula(field.formula || '', formData);
                      return (
                        <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">{field.label}</label>
                          <div className="formula-box">
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              Formula: {field.formula}
                            </span>
                            <span className="formula-value">{computed}</span>
                          </div>
                          {field.help_text && <span className="form-helper">{field.help_text}</span>}
                        </div>
                      );
                    }

                    return (
                      <div key={field.key} className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">
                          {field.label}
                          {field.required && <span className="required-star">*</span>}
                        </label>

                        {field.type === 'number' && (
                          <input
                            type="number"
                            className="form-input"
                            min={field.min}
                            max={field.max}
                            disabled={activeTask.status === 'DONE'}
                            value={formData[field.key] ?? ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                          />
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            className="form-input"
                            disabled={activeTask.status === 'DONE'}
                            value={formData[field.key] ?? ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder || 'Isikan catatan pengamatan...'}
                          />
                        )}

                        {field.type === 'dropdown' && (
                          <div>
                            {field.key === 'observation_time_slot' && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.45rem 0.65rem',
                                background: activeTask.target_time_slot ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
                                border: `1px solid ${activeTask.target_time_slot ? '#818cf8' : 'rgba(99, 102, 241, 0.25)'}`,
                                borderRadius: '6px',
                                marginBottom: '0.5rem',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>
                                  {activeTask.target_time_slot ? <Lock size={13} color="#818cf8" /> : <Clock size={13} color="#818cf8" />}
                                  <span>{activeTask.target_time_slot ? 'Slot Ditugaskan Admin (Terkunci)' : 'Slot Waktu Pengamatan'}</span>
                                </div>
                                {!activeTask.target_time_slot && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '2px 8px', fontSize: '0.72rem', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                                    disabled={activeTask.status === 'DONE'}
                                    onClick={() => {
                                      const curH = new Date().getHours();
                                      const hourPrefix = String(curH).padStart(2, '0') + ':00';
                                      const matched = field.options?.find((opt) => opt.startsWith(hourPrefix));
                                      handleFieldChange('observation_time_slot', matched || field.options?.[0]);
                                    }}
                                  >
                                    Pilih Jam Sekarang
                                  </button>
                                )}
                              </div>
                            )}

                            {activeTask.target_time_slot && field.key === 'observation_time_slot' ? (
                              <div style={{
                                padding: '0.65rem 0.85rem',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                color: '#e0e7ff',
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}>
                                <span>{formData[field.key] || activeTask.target_time_slot}</span>
                                <span style={{ fontSize: '0.72rem', color: '#818cf8' }}><Lock size={12} /> Dikunci Admin</span>
                              </div>
                            ) : (
                              <select
                                className="form-select"
                                disabled={activeTask.status === 'DONE'}
                                value={formData[field.key] ?? ''}
                                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              >
                                <option value="">-- Pilih {field.label} --</option>
                                {field.options?.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}

                        {field.type === 'radio' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {field.options?.map((opt) => (
                              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name={field.key}
                                  disabled={activeTask.status === 'DONE'}
                                  checked={formData[field.key] === opt}
                                  onChange={() => handleFieldChange(field.key, opt)}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        )}

                        {field.type === 'yes_no' && (
                          <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={field.key}
                                disabled={activeTask.status === 'DONE'}
                                checked={formData[field.key] === true}
                                onChange={() => handleFieldChange(field.key, true)}
                              />
                              Ya
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name={field.key}
                                disabled={activeTask.status === 'DONE'}
                                checked={formData[field.key] === false}
                                onChange={() => handleFieldChange(field.key, false)}
                              />
                              Tidak
                            </label>
                          </div>
                        )}

                        {field.type === 'photo' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input
                              type="text"
                              className="form-input"
                              disabled={activeTask.status === 'DONE'}
                              placeholder="Masukkan URL screenshot atau klik gunakan snapshot kamera"
                              value={formData[field.key] || ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            />
                            {activeTask.status !== 'DONE' && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleFieldChange(field.key, 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80')}
                              >
                                Lampirkan Bukti Foto Layar CCTV
                              </button>
                            )}
                          </div>
                        )}

                        {field.help_text && (
                          <span className="form-helper">{field.help_text}</span>
                        )}
                      </div>
                    );
                  })}

                  <div className="form-group" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                    <label className="form-label">Catatan Tambahan Petugas</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      disabled={activeTask.status === 'DONE'}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan kendala teknis atau observasi lainnya..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveTask(null)}>
                Tutup
              </button>

              {activeTask.status !== 'DONE' && (
                <>
                  <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={submitting}>
                    <Save size={16} /> Simpan Draft
                  </button>
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                    <Send size={16} /> Kirim Hasil Selesai (Submit)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
