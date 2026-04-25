import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { Icon } from './components/icons';
import { Spinner } from './components/primitives';

import Landing    from './screens/Landing';
import Login      from './screens/Login';
import Register   from './screens/Register';
import Dashboard  from './screens/Dashboard';
import Upload     from './screens/Upload';
import Confirm    from './screens/Confirm';
import List       from './screens/List';
import Detail     from './screens/Detail';
import Report     from './screens/Report';
import Categories from './screens/Categories';
import Settings   from './screens/Settings';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh' }}>
      <Spinner size={32} color="#13B5B1" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  const { mode, toggle } = useTheme();
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
        <Route path="/login"    element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />

        <Route path="/dashboard"    element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/upload"       element={<RequireAuth><Upload /></RequireAuth>} />
        <Route path="/confirm/:id"  element={<RequireAuth><Confirm /></RequireAuth>} />
        <Route path="/list"         element={<RequireAuth><List /></RequireAuth>} />
        <Route path="/detail/:id"   element={<RequireAuth><Detail /></RequireAuth>} />
        <Route path="/report"       element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="/categories"   element={<RequireAuth><Categories /></RequireAuth>} />
        <Route path="/settings"     element={<RequireAuth><Settings /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Dark/light toggle — only shown on authenticated screens */}
      {user && (
        <button
          onClick={toggle}
          title={mode === 'dark' ? '切换浅色模式' : '切换深色模式'}
          style={{
            position: 'fixed',
            bottom: 90,
            right: 16,
            zIndex: 200,
            width: 36,
            height: 36,
            borderRadius: 18,
            background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
            border: 'none',
            color: mode === 'dark' ? '#fff' : '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <Icon name={mode === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
      )}
    </>
  );
}
