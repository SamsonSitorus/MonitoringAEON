import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { FormBuilderView } from './components/FormBuilderView';
import { InspectorTaskView } from './components/InspectorTaskView';
import { TaskManagementView } from './components/TaskManagementView';
import { CameraManagementView } from './components/CameraManagementView';
import { SupervisorReviewView } from './components/SupervisorReviewView';
import { ReportsView } from './components/ReportsView';
import { UserManagementView } from './components/UserManagementView';
import { WeeklyProgressMatrixView } from './components/WeeklyProgressMatrixView';
import { LoginView } from './components/LoginView';
import { api } from './services/api';
import { User } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [initLoading, setInitLoading] = useState<boolean>(true);
  const [taskNavParams, setTaskNavParams] = useState<{
    initialCameraId?: string;
    initialDate?: string;
    autoOpenBatchModal?: boolean;
  } | null>(null);

  const handleNavigateToTasks = (params?: { initialCameraId?: string; initialDate?: string; autoOpenBatchModal?: boolean }) => {
    setTaskNavParams(params || null);
    setActiveTab('task-management');
  };

  // Check existing token or show login screen
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = api.getToken();
        if (token) {
          const user = await api.getMe();
          setCurrentUser(user);
          setActiveTab(user.role === 'inspector' ? 'inspector-tasks' : 'dashboard');
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Session verification fallback to login view:', err);
        api.logout();
        setCurrentUser(null);
      } finally {
        setInitLoading(false);
      }
    };
    initAuth();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'inspector') {
      setActiveTab('inspector-tasks');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  if (initLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-canvas)',
        color: 'var(--accent-cyan)',
        fontFamily: 'var(--font-sans)',
      }}>
        <h2>Memuat CamTrack System...</h2>
      </div>
    );
  }

  // If user is not logged in, show the Login Screen
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        currentUser={currentUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
      />

      <div className="main-content">
        <Navbar
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main>
          {/* Admin Exclusive Views */}
          {currentUser.role === 'admin' && (
            <>
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'progress-matrix' && (
                <WeeklyProgressMatrixView
                  currentUser={currentUser}
                  onNavigateToTasks={handleNavigateToTasks}
                />
              )}
              {activeTab === 'users' && <UserManagementView />}
              {activeTab === 'cameras' && <CameraManagementView />}
              {activeTab === 'form-builder' && <FormBuilderView />}
              {activeTab === 'task-management' && (
                <TaskManagementView
                  initialCameraId={taskNavParams?.initialCameraId}
                  initialDate={taskNavParams?.initialDate}
                  autoOpenBatchModal={taskNavParams?.autoOpenBatchModal}
                  onClearNavParams={() => setTaskNavParams(null)}
                />
              )}
              {activeTab === 'reports' && <ReportsView />}
            </>
          )}

          {/* Inspector Exclusive Views */}
          {currentUser.role === 'inspector' && (
            <>
              {activeTab === 'inspector-tasks' && <InspectorTaskView currentUser={currentUser} />}
              {activeTab === 'reports' && <ReportsView />}
            </>
          )}

          {/* Supervisor Exclusive Views */}
          {currentUser.role === 'supervisor' && (
            <>
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'progress-matrix' && <WeeklyProgressMatrixView currentUser={currentUser} />}
              {activeTab === 'supervisor-reviews' && <SupervisorReviewView currentUser={currentUser} />}
              {activeTab === 'reports' && <ReportsView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
