import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, UserCheck, Eye, Search, RefreshCw, Key, X } from 'lucide-react';
import { api } from '../services/api';
import { User, UserRole } from '../types';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Add/Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'inspector' as UserRole,
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memuat pengguna', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'inspector',
      password: '',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '', // blank unless updating
    });
    setShowAddModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password ? formData.password : undefined,
        });
        setMessage({ text: 'Data pengguna berhasil diperbarui!', type: 'success' });
      } else {
        if (!formData.password) {
          alert('Kata sandi wajib diisi untuk pengguna baru!');
          return;
        }
        await api.createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
        });
        setMessage({ text: 'Pengguna baru berhasil ditambahkan!', type: 'success' });
      }
      setShowAddModal(false);
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan pengguna', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus akun ${name}?`)) return;
    try {
      await api.deleteUser(id);
      setMessage({ text: `Akun ${name} berhasil dihapus`, type: 'success' });
      await loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menghapus pengguna', type: 'error' });
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h2>Manajemen Akun & Hak Akses Pengguna</h2>
          <p>Kelola akun administrator, petugas lapangan (Inspector), dan supervisor tim.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={loadUsers}>
            <RefreshCw size={16} /> Perbarui
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> Tambah Pengguna Baru
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

      {/* FILTER & SEARCH BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-dim)' }} />
          <input
            className="form-input"
            style={{ width: '100%', paddingLeft: '2.4rem' }}
            placeholder="Cari nama atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'ALL', label: `Semua (${users.length})` },
            { key: 'admin', label: `Admin (${users.filter(u => u.role === 'admin').length})` },
            { key: 'inspector', label: `Inspector (${users.filter(u => u.role === 'inspector').length})` },
            { key: 'supervisor', label: `Supervisor (${users.filter(u => u.role === 'supervisor').length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key)}
              style={{
                background: roleFilter === tab.key ? 'var(--bg-card-hover)' : 'transparent',
                border: `1px solid ${roleFilter === tab.key ? 'var(--accent-cyan)' : 'transparent'}`,
                color: roleFilter === tab.key ? 'var(--accent-cyan)' : 'var(--text-muted)',
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
      </div>

      {/* USERS TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
              <th style={{ padding: '0.85rem 1.25rem' }}>PENGGUNA</th>
              <th style={{ padding: '0.85rem 1rem' }}>EMAIL</th>
              <th style={{ padding: '0.85rem 1rem' }}>ROLE / HAK AKSES</th>
              <th style={{ padding: '0.85rem 1rem' }}>TANGGAL TERDAFTAR</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: u.role === 'admin' ? 'linear-gradient(135deg, #a855f7, #6366f1)' : u.role === 'inspector' ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                    }}>
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'white' }}>{u.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{u.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                  {u.email}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span className={`user-badge badge-${u.role}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  {new Date(u.created_at).toLocaleDateString('id-ID')}
                </td>
                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleOpenEdit(u)}
                      title="Edit Akun"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      title="Hapus Akun"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT USER MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <form onSubmit={handleSaveUser}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editingUser ? <Edit2 size={18} color="#38bdf8" /> : <Plus size={18} color="#38bdf8" />}
                  {editingUser ? 'Edit Akun Pengguna' : 'Tambah Pengguna Baru'}
                </h3>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nama Lengkap *</label>
                  <input
                    className="form-input"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Rudi Pratama"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alamat Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nama@camtrack.io"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Hak Akses / Peran (Role) *</label>
                  <select
                    className="form-select"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  >
                    <option value="inspector">Inspector (Petugas Pengecekan Kamera)</option>
                    <option value="supervisor">Supervisor (Pengawas & Reviewer)</option>
                    <option value="admin">Administrator (Pengelola Sistem Lengkap)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {editingUser ? 'Ganti Password (Kosongkan jika tidak diubah)' : 'Kata Sandi Awal *'}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? '••••••••' : 'Minimal 6 karakter...'}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : editingUser ? 'Perbarui Akun' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
