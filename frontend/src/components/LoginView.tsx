import React, { useState } from 'react';
import { Camera, Lock, Mail, Eye, EyeOff, Shield, UserCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { User, UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi');
      return;
    }

    try {
      setLoading(true);
      const res = await api.login(email, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login gagal, periksa email dan kata sandi Anda');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole, userId?: string) => {
    setError(null);
    try {
      setLoading(true);
      const res = await api.demoLogin(role, userId);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Gagal masuk akun demo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 10% 20%, rgba(14, 165, 233, 0.12), transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.1), transparent 45%), var(--bg-canvas)',
      padding: '2rem 1rem',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2.5rem',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #0284c7, #6366f1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 0 20px rgba(2, 132, 199, 0.5)',
            marginBottom: '1rem',
          }}>
            <Camera size={28} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            CamTrack
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Dynamic Camera Inspection & Progress Monitoring
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '9999px',
            padding: '3px 10px',
            fontSize: '0.72rem',
            color: '#34d399',
            marginTop: '8px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Neon PostgreSQL Connected
          </div>
        </div>

        {error && (
          <div style={{
            padding: '0.85rem 1rem',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            color: '#fb7185',
          }}>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>
              <Mail size={14} color="#38bdf8" /> Email Akun
            </label>
            <input
              type="email"
              className="form-input"
              required
              placeholder="nama@camtrack.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>
              <Lock size={14} color="#38bdf8" /> Kata Sandi (Password)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '2.5rem' }}
                required
                placeholder="Masukkan kata sandi..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.92rem' }}
          >
            {loading ? 'Memproses...' : 'Masuk ke Sistem'} <ArrowRight size={16} />
          </button>
        </form>

        {/* Quick Demo Personas Helper */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '0.85rem' }}>
            Atau gunakan akses demo sekali-klik:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.55rem', justifyContent: 'flex-start' }}
              onClick={() => handleQuickLogin('admin', 'usr-admin-01')}
            >
              <Shield size={14} color="#c084fc" />
              <span>Admin (Budi)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.55rem', justifyContent: 'flex-start' }}
              onClick={() => handleQuickLogin('supervisor', 'usr-spv-01')}
            >
              <CheckCircle2 size={14} color="#34d399" />
              <span>Supervisor</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.55rem', justifyContent: 'flex-start' }}
              onClick={() => handleQuickLogin('inspector', 'usr-insp-01')}
            >
              <UserCheck size={14} color="#38bdf8" />
              <span>Inspector (Rudi)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.55rem', justifyContent: 'flex-start' }}
              onClick={() => handleQuickLogin('inspector', 'usr-insp-02')}
            >
              <UserCheck size={14} color="#38bdf8" />
              <span>Inspector (Siti)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
