import React from 'react';
import { 
  LayoutDashboard, 
  Camera, 
  Sliders, 
  CheckSquare, 
  ClipboardList, 
  ShieldCheck, 
  FileText,
  Users,
  LogOut,
  CalendarDays
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  currentUser: User | null;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentUser, activeTab, onSelectTab, onLogout }) => {
  const role = currentUser?.role || 'admin';

  return (
    <aside className="app-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Active User Card */}
      <div className="sidebar-user-card">
        <div className="user-avatar">
          {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'CT'}
        </div>
        <div className="user-meta" style={{ overflow: 'hidden' }}>
          <h4 style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {currentUser?.name || 'Memuat...'}
          </h4>
          <span className={`user-badge badge-${role}`}>
            {role.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Admin Menu */}
        {role === 'admin' && (
          <>
            <div className="nav-section-title">ADMINISTRASI & SETUP</div>
            <nav className="nav-menu">
              <button
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => onSelectTab('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard Monitoring</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'progress-matrix' ? 'active' : ''}`}
                onClick={() => onSelectTab('progress-matrix')}
              >
                <CalendarDays size={18} />
                <span>Matriks Progres CCTV</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => onSelectTab('users')}
              >
                <Users size={18} />
                <span>Manajemen Akun</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'cameras' ? 'active' : ''}`}
                onClick={() => onSelectTab('cameras')}
              >
                <Camera size={18} />
                <span>Master Kamera</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'form-builder' ? 'active' : ''}`}
                onClick={() => onSelectTab('form-builder')}
              >
                <Sliders size={18} />
                <span>Form Builder Dinamis</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'task-management' ? 'active' : ''}`}
                onClick={() => onSelectTab('task-management')}
              >
                <CheckSquare size={18} />
                <span>Penugasan (Task)</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => onSelectTab('reports')}
              >
                <FileText size={18} />
                <span>Laporan & Audit</span>
              </button>
            </nav>
          </>
        )}

        {/* Inspector Menu */}
        {role === 'inspector' && (
          <>
            <div className="nav-section-title">TUGAS SAYA</div>
            <nav className="nav-menu">
              <button
                className={`nav-item ${activeTab === 'inspector-tasks' ? 'active' : ''}`}
                onClick={() => onSelectTab('inspector-tasks')}
              >
                <ClipboardList size={18} />
                <span>Daftar Pengecekan</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => onSelectTab('reports')}
              >
                <FileText size={18} />
                <span>Histori Kiriman Saya</span>
              </button>
            </nav>
          </>
        )}

        {/* Supervisor Menu */}
        {role === 'supervisor' && (
          <>
            <div className="nav-section-title">PENGAWASAN & REVIEW</div>
            <nav className="nav-menu">
              <button
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => onSelectTab('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Monitoring Progress</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'progress-matrix' ? 'active' : ''}`}
                onClick={() => onSelectTab('progress-matrix')}
              >
                <CalendarDays size={18} />
                <span>Matriks Progres CCTV</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'supervisor-reviews' ? 'active' : ''}`}
                onClick={() => onSelectTab('supervisor-reviews')}
              >
                <ShieldCheck size={18} />
                <span>Review Hasil Inspeksi</span>
              </button>
              <button
                className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => onSelectTab('reports')}
              >
                <FileText size={18} />
                <span>Laporan & Ekspor CSV</span>
              </button>
            </nav>
          </>
        )}
      </div>

      {/* Bottom Logout Button */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'flex-start', color: '#fb7185', background: 'rgba(244, 63, 94, 0.08)' }}
          onClick={onLogout}
        >
          <LogOut size={16} />
          <span>Keluar (Logout)</span>
        </button>
      </div>
    </aside>
  );
};
