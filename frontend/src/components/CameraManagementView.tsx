import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Server, 
  Layers, 
  Filter, 
  Search, 
  EyeOff, 
  AlertTriangle, 
  X, 
  CheckCircle2 
} from 'lucide-react';
import { api } from '../services/api';
import { Camera as CameraType, CameraSystem } from '../types';
import { Pagination } from './Pagination';

const NVR_PRESETS: Record<CameraSystem, string[]> = {
  InaAI: ['NVR1.10.1.6.3', 'NVR1.10.1.6.4'],
  AEON: ['NVR AEON.10.123.32.20'],
};

export const CameraManagementView: React.FC = () => {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [systemFilter, setSystemFilter] = useState<'ALL' | CameraSystem>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'online' | 'offline' | 'maintenance'>('ALL');
  const [nvrFilter, setNvrFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    system: 'InaAI' as CameraSystem,
    nvr: 'NVR1.10.1.6.3',
    channel_no: 1,
    status: 'online' as 'online' | 'offline' | 'maintenance',
  });
  const [customNvr, setCustomNvr] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const data = await api.getCameras();
      setCameras(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memuat master kamera', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemChange = (sys: CameraSystem) => {
    const defaultNvr = NVR_PRESETS[sys]?.[0] || '';
    setFormData({
      ...formData,
      system: sys,
      nvr: defaultNvr,
    });
    setCustomNvr(false);
  };

  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCamera({
        name: formData.name,
        code: formData.code,
        system: formData.system,
        nvr: formData.nvr,
        channel_no: Number(formData.channel_no) || 1,
        status: formData.status,
      } as any);
      setMessage({ text: 'Kamera baru berhasil ditambahkan ke sistem!', type: 'success' });
      setShowAddModal(false);
      setFormData({
        name: '',
        code: '',
        system: 'InaAI',
        nvr: 'NVR1.10.1.6.3',
        channel_no: 1,
        status: 'online',
      });
      setCustomNvr(false);
      await loadCameras();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan kamera', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus kamera ini? Semua penugasan terkait akan terhapus.')) return;
    try {
      await api.deleteCamera(id);
      setMessage({ text: 'Kamera berhasil dihapus', type: 'success' });
      await loadCameras();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menghapus kamera', type: 'error' });
    }
  };

  // Filter cameras
  const filteredCameras = cameras.filter((cam) => {
    if (systemFilter !== 'ALL' && cam.system !== systemFilter) return false;
    if (statusFilter !== 'ALL' && cam.status !== statusFilter) return false;
    if (nvrFilter !== 'ALL' && cam.nvr !== nvrFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = cam.name.toLowerCase().includes(q);
      const matchCode = cam.code.toLowerCase().includes(q);
      const matchNvr = cam.nvr?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchNvr) return false;
    }
    return true;
  });

  // Extract unique NVRs for filter
  const availableNvrs = Array.from(new Set(cameras.map((c) => c.nvr).filter(Boolean)));

  // Counts for status
  const onlineCount = cameras.filter((c) => c.status === 'online').length;
  const offlineCount = cameras.filter((c) => c.status === 'offline').length;
  const maintenanceCount = cameras.filter((c) => c.status === 'maintenance').length;
  const isFiltering = systemFilter !== 'ALL' || statusFilter !== 'ALL' || nvrFilter !== 'ALL' || search.trim() !== '';

  useEffect(() => {
    setCurrentPage(1);
  }, [systemFilter, statusFilter, nvrFilter, search]);

  const totalPages = Math.ceil(filteredCameras.length / pageSize) || 1;
  const paginatedCameras = filteredCameras.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetFilters = () => {
    setSystemFilter('ALL');
    setStatusFilter('ALL');
    setNvrFilter('ALL');
    setSearch('');
    setCurrentPage(1);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Master Titik Kamera CCTV & NVR</h2>
          <p>Konfigurasi pemetaan kamera berdasarkan Sistem (InaAI / AEON), NVR, dan Nomor Channel fisik.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadCameras}>
            <RefreshCw size={16} /> Perbarui
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Tambah Kamera Baru
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
          <button onClick={() => setMessage(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* REFINED FILTER TOOLBAR */}
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
        {/* Row 1: System and Status Pills */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* System Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Layers size={14} color="var(--accent-cyan)" /> SISTEM:
            </span>
            <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setSystemFilter('ALL')}
                style={{
                  background: systemFilter === 'ALL' ? 'var(--primary)' : 'transparent',
                  color: systemFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Semua ({cameras.length})
              </button>
              <button
                type="button"
                onClick={() => setSystemFilter('InaAI')}
                style={{
                  background: systemFilter === 'InaAI' ? '#0ea5e9' : 'transparent',
                  color: systemFilter === 'InaAI' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                InaAI ({cameras.filter((c) => c.system === 'InaAI').length})
              </button>
              <button
                type="button"
                onClick={() => setSystemFilter('AEON')}
                style={{
                  background: systemFilter === 'AEON' ? '#8b5cf6' : 'transparent',
                  color: systemFilter === 'AEON' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                AEON ({cameras.filter((c) => c.system === 'AEON').length})
              </button>
            </div>
          </div>

          {/* Status Pills with Color Coding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
              <Filter size={14} color="#818cf8" /> STATUS:
            </span>
            <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                style={{
                  background: statusFilter === 'ALL' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 9px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('online')}
                style={{
                  background: statusFilter === 'online' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: statusFilter === 'online' ? '#34d399' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 9px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                Online ({onlineCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('offline')}
                style={{
                  background: statusFilter === 'offline' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                  color: statusFilter === 'offline' ? '#fb7185' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 9px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Kamera offline / blindspot tidak tertangkap gambar"
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e' }} />
                Blindspot / Offline ({offlineCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('maintenance')}
                style={{
                  background: statusFilter === 'maintenance' ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                  color: statusFilter === 'maintenance' ? '#fbbf24' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 9px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
                Maintenance ({maintenanceCount})
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Search Input, NVR Select & Reset */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-dim)' }} />
              <input
                type="text"
                className="form-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode kamera, lokasi, atau nama..."
                style={{ padding: '0.45rem 2rem 0.45rem 2.2rem', fontSize: '0.82rem', width: '100%' }}
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
                  <X size={14} />
                </button>
              )}
            </div>

            {/* NVR Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Server size={14} color="#818cf8" />
              <select
                className="form-select"
                value={nvrFilter}
                onChange={(e) => setNvrFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', width: 'auto', minWidth: '150px' }}
              >
                <option value="ALL">Semua NVR ({availableNvrs.length})</option>
                {availableNvrs.map((nvr) => (
                  <option key={nvr} value={nvr}>
                    {nvr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Counter & Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Menampilkan <strong style={{ color: '#ffffff' }}>{filteredCameras.length}</strong> dari{' '}
              <strong>{cameras.length}</strong> titik kamera
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

      {/* CAMERAS GRID - PURE TECHNICAL INFO WITHOUT IMAGE */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Memuat daftar kamera...</div>
      ) : filteredCameras.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Camera size={40} color="var(--text-dim)" style={{ margin: '0 auto 0.75rem' }} />
          <h3>Tidak ada kamera yang cocok</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Silakan sesuaikan filter atau tambahkan titik kamera baru.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {paginatedCameras.map((cam) => (
            <div
              key={cam.id}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `4px solid ${cam.system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
              }}
            >
              <div>
                {/* Header: System, Channel, Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: cam.system === 'InaAI' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        border: `1px solid ${cam.system === 'InaAI' ? '#0ea5e9' : '#8b5cf6'}`,
                        color: cam.system === 'InaAI' ? '#38bdf8' : '#c084fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Layers size={11} /> {cam.system || 'InaAI'}
                    </span>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Ch. {cam.channel_no || 1}
                    </span>
                  </div>

                  {cam.status === 'online' ? (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Wifi size={11} color="#34d399" />
                      ONLINE (AKTIF)
                    </span>
                  ) : cam.status === 'offline' ? (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(244, 63, 94, 0.18)',
                        border: '1px solid rgba(244, 63, 94, 0.45)',
                        color: '#fb7185',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 0 10px rgba(244, 63, 94, 0.2)',
                      }}
                      title="Kamera offline membentuk titik buta (Blindspot)"
                    >
                      <EyeOff size={11} color="#fb7185" />
                      BLINDSPOT (OFFLINE)
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(245, 158, 11, 0.18)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#fbbf24',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <AlertTriangle size={11} color="#fbbf24" />
                      MAINTENANCE
                    </span>
                  )}
                </div>

                {/* Camera Code & Name */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700, marginBottom: '2px' }}>
                  {cam.code}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>{cam.name}</h3>

                {/* Blindspot Alert banner if offline */}
                {cam.status === 'offline' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.74rem',
                      background: 'rgba(244, 63, 94, 0.12)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      color: '#fb7185',
                      padding: '4px 8px',
                      borderRadius: '5px',
                      marginBottom: '0.75rem',
                      fontWeight: 500,
                    }}
                  >
                    <EyeOff size={13} color="#f43f5e" />
                    <span>Titik buta aktif: Kamera terputus dari jaringan CCTV.</span>
                  </div>
                )}

                {/* NVR Details Box */}
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a5b4fc' }}>
                    <Server size={13} color="#818cf8" />
                    <span>
                      <strong>NVR:</strong> {cam.nvr || '-'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    Port Ch. {cam.channel_no || 1}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>ID: {cam.id}</span>
                <button
                  onClick={() => handleDelete(cam.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fb7185',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Hapus Kamera"
                >
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INTERACTIVE PAGINATION */}
      {!loading && filteredCameras.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredCameras.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSizeOptions={[6, 12, 24, 48]}
        />
      )}

      {/* ADD CAMERA MODAL - NO IMAGE FIELD */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleSaveCamera}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={18} color="#38bdf8" />
                  Tambah Titik Kamera CCTV Baru
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* 1. Pilih Sistem Kamera */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} color="#38bdf8" /> 1. Sistem Kamera *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {(['InaAI', 'AEON'] as CameraSystem[]).map((sys) => {
                      const isSel = formData.system === sys;
                      return (
                        <label
                          key={sys}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0.75rem 1rem',
                            borderRadius: '6px',
                            border: `1px solid ${isSel ? (sys === 'InaAI' ? '#0ea5e9' : '#8b5cf6') : 'var(--border-subtle)'}`,
                            background: isSel
                              ? sys === 'InaAI'
                                ? 'rgba(14, 165, 233, 0.15)'
                                : 'rgba(139, 92, 246, 0.15)'
                              : 'var(--bg-card-subtle)',
                            cursor: 'pointer',
                            color: isSel ? '#ffffff' : 'var(--text-dim)',
                            fontWeight: isSel ? 700 : 400,
                          }}
                        >
                          <input
                            type="radio"
                            name="system"
                            value={sys}
                            checked={isSel}
                            onChange={() => handleSystemChange(sys)}
                          />
                          <span>{sys}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Pilih NVR & Channel */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Server size={14} color="#a5b4fc" /> 2. NVR (Network Video Recorder) *
                    </label>
                    {!customNvr ? (
                      <select
                        className="form-select"
                        value={formData.nvr}
                        onChange={(e) => {
                          if (e.target.value === '__CUSTOM__') {
                            setCustomNvr(true);
                            setFormData({ ...formData, nvr: '' });
                          } else {
                            setFormData({ ...formData, nvr: e.target.value });
                          }
                        }}
                      >
                        {NVR_PRESETS[formData.system]?.map((nvr) => (
                          <option key={nvr} value={nvr}>
                            {nvr}
                          </option>
                        ))}
                        <option value="__CUSTOM__">+ Input NVR Manual...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          className="form-input"
                          required
                          value={formData.nvr}
                          onChange={(e) => setFormData({ ...formData, nvr: e.target.value })}
                          placeholder="Contoh: NVR1.10.1.6.5"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={() => {
                            setCustomNvr(false);
                            setFormData({ ...formData, nvr: NVR_PRESETS[formData.system]?.[0] || '' });
                          }}
                        >
                          Pilihan
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Channel NVR *</label>
                    <input
                      type="number"
                      className="form-input"
                      required
                      min={1}
                      max={64}
                      value={formData.channel_no}
                      onChange={(e) => setFormData({ ...formData, channel_no: Number(e.target.value) })}
                      placeholder="1"
                    />
                  </div>
                </div>

                {/* 3. Detail Kamera */}
                <div className="form-group">
                  <label className="form-label">Nama Titik Kamera *</label>
                  <input
                    className="form-input"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Lobby Utama Gedung A"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Kode Kamera (Unique) *</label>
                    <input
                      className="form-input"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="CAM-LOBBY-A"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status Awal</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value as 'online' | 'offline' | 'maintenance' })
                      }
                    >
                      <option value="online">Online</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Kamera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
