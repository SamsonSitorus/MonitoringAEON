import React from 'react';
import { Camera, Clock, Database, LogOut, Shield, UserCheck, Eye } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onLogout }) => {
  const [time, setTime] = React.useState(new Date().toLocaleTimeString('id-ID'));

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('id-ID'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'admin':
        return <Shield size={14} color="#c084fc" />;
      case 'inspector':
        return <UserCheck size={14} color="#38bdf8" />;
      case 'supervisor':
        return <Eye size={14} color="#34d399" />;
      default:
        return null;
    }
  };

  return (
    <header className="top-navbar">
      <div className="navbar-brand">
        <div className="brand-logo-glow">
          <Camera size={20} />
        </div>
        <div className="brand-text">
          <h1>CamTrack</h1>
          <p>Camera Inspection & Progress Monitor</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Neon Database Live Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '9999px',
          padding: '4px 10px',
          fontSize: '0.74rem',
          color: '#34d399',
          fontFamily: 'var(--font-mono)',
        }}>
          <Database size={13} color="#10b981" />
          <span>API :8080 · Neon DB</span>
        </div>

        {/* Live Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          <Clock size={13} color="#38bdf8" />
          <span>{time} WIB</span>
        </div>

        {/* Active User Identity (Strict to logged-in user only) */}
        {currentUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 12px 4px 6px',
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: currentUser.role === 'admin' ? 'linear-gradient(135deg, #a855f7, #6366f1)' : currentUser.role === 'inspector' ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}>
              {currentUser.name.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', lineHeight: 1.2 }}>
                {currentUser.name}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {getRoleIcon(currentUser.role)}
                {currentUser.role.toUpperCase()}
              </span>
            </div>

            <button
              onClick={onLogout}
              title="Keluar (Logout)"
              style={{
                marginLeft: '6px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                color: '#fb7185',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <LogOut size={12} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
