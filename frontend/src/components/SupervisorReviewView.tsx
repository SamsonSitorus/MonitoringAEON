import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Eye, 
  UserCheck, 
  AlertTriangle,
  Send,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { InspectionRecord, User } from '../types';

interface SupervisorReviewViewProps {
  currentUser: User | null;
}

export const SupervisorReviewView: React.FC<SupervisorReviewViewProps> = ({ currentUser }) => {
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [filterReview, setFilterReview] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await api.getRecords();
      setRecords(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memuat rekam inspeksi', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (status: 'APPROVED' | 'REVISION_REQUESTED') => {
    if (!selectedRecord) return;
    if (status === 'REVISION_REQUESTED' && !reviewNotes.trim()) {
      alert('Mohon cantumkan catatan alasan kenapa inspeksi perlu dicek ulang!');
      return;
    }

    try {
      setSubmitting(true);
      await api.reviewRecord(selectedRecord.id, status, reviewNotes);
      setMessage({ 
        text: status === 'APPROVED' ? 'Inspeksi berhasil disetujui (Approved)!' : 'Permintaan revisi telah dikirimkan ke petugas!', 
        type: 'success' 
      });
      setSelectedRecord(null);
      setReviewNotes('');
      await loadRecords();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memproses review', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (filterReview === 'ALL') return true;
    return r.review_status === filterReview;
  });

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Verifikasi & Review Hasil Observasi</h2>
          <p>
            Supervisor: <strong>{currentUser?.name}</strong> · Tinjau keakuratan data kiriman petugas, berikan persetujuan, atau minta cek ulang jika ada kejanggalan.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadRecords}>
            <RefreshCw size={16} /> Perbarui
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
          color: message.type === 'success' ? '#34d399' : '#fb7185',
        }}>
          {message.text}
        </div>
      )}

      {/* FILTER BUTTONS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
        {[
          { key: 'ALL', label: `Semua (${records.length})` },
          { key: 'PENDING', label: `Menunggu Review (${records.filter(r => r.review_status === 'PENDING').length})` },
          { key: 'APPROVED', label: `Disetujui (${records.filter(r => r.review_status === 'APPROVED').length})` },
          { key: 'REVISION_REQUESTED', label: `Diminta Cek Ulang (${records.filter(r => r.review_status === 'REVISION_REQUESTED').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterReview(tab.key)}
            style={{
              background: filterReview === tab.key ? 'var(--bg-card-hover)' : 'transparent',
              border: `1px solid ${filterReview === tab.key ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
              color: filterReview === tab.key ? 'var(--accent-cyan)' : 'var(--text-muted)',
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

      {/* RECORDS TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
              <th style={{ padding: '0.85rem 1.25rem' }}>ID RECORD</th>
              <th style={{ padding: '0.85rem 1rem' }}>KAMERA & LOKASI</th>
              <th style={{ padding: '0.85rem 1rem' }}>PETUGAS (INSPECTOR)</th>
              <th style={{ padding: '0.85rem 1rem' }}>JENIS PENGECEKAN</th>
              <th style={{ padding: '0.85rem 1rem' }}>STATUS REVIEW</th>
              <th style={{ padding: '0.85rem 1rem' }}>WAKTU SUBMIT</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '1rem 1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  {r.id}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 600, color: 'white' }}>{r.camera_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{r.camera_code}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 600 }}>{r.inspector_name}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                    {r.template_name} (v{r.version_number})
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {r.review_status === 'APPROVED' && (
                    <span className="status-pill status-done"><CheckCircle2 size={12} /> Approved</span>
                  )}
                  {r.review_status === 'PENDING' && (
                    <span className="status-pill status-in-progress"><Clock size={12} /> Menunggu Review</span>
                  )}
                  {r.review_status === 'REVISION_REQUESTED' && (
                    <span className="status-pill status-revision"><AlertTriangle size={12} /> Revisi Diminta</span>
                  )}
                </td>
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {new Date(r.submitted_at).toLocaleString('id-ID')}
                </td>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      setSelectedRecord(r);
                      setReviewNotes(r.review_notes || '');
                    }}
                  >
                    <Eye size={14} /> Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REVIEW DETAILS MODAL */}
      {selectedRecord && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#10b981" />
                Review Hasil Observasi: {selectedRecord.camera_name} ({selectedRecord.camera_code})
              </h3>
              <button onClick={() => setSelectedRecord(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', background: 'var(--bg-card-subtle)', padding: '1rem', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Petugas Pelapor:</div>
                  <div style={{ fontWeight: 600 }}>{selectedRecord.inspector_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '6px' }}>Waktu Kirim:</div>
                  <div style={{ fontSize: '0.85rem' }}>{new Date(selectedRecord.submitted_at).toLocaleString('id-ID')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Template Form Digunakan:</div>
                  <div style={{ fontWeight: 600 }}>{selectedRecord.template_name} (Versi v{selectedRecord.version_number})</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '6px' }}>Status Saat Ini:</div>
                  <div style={{ fontWeight: 700, color: selectedRecord.review_status === 'APPROVED' ? '#34d399' : '#fbbf24' }}>
                    {selectedRecord.review_status}
                  </div>
                </div>
              </div>

              {/* Submitted Payload Answers */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--accent-cyan)' }}>
                  Data Hasil Observasi Faktual (JSONB Payload):
                </h4>
                <div style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '1rem' }}>
                  {Object.entries(selectedRecord.payload || {}).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{key}:</span>
                      <strong style={{ color: typeof val === 'boolean' ? (val ? '#fb7185' : '#34d399') : 'white' }}>
                        {typeof val === 'boolean' ? (val ? 'Ya' : 'Tidak') : String(val)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRecord.notes && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Catatan Petugas:</div>
                  <div style={{ background: 'var(--bg-card-subtle)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                    {selectedRecord.notes}
                  </div>
                </div>
              )}

              {/* Supervisor Feedback Input */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Catatan / Komentar Review Supervisor</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Isikan catatan verifikasi, rekomendasi, atau alasan permintaan cek ulang..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRecord(null)}>
                Batal
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleReviewAction('REVISION_REQUESTED')}
                disabled={submitting}
              >
                <AlertTriangle size={15} /> Minta Cek Ulang (Revisi)
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleReviewAction('APPROVED')}
                disabled={submitting}
              >
                <CheckCircle2 size={15} /> Setujui Hasil (Approve)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
