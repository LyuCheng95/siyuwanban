import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { DiscoverPage } from './pages/DiscoverPage';
import { MyCharsPage } from './pages/MyCharsPage';
import { WizardPage } from './pages/WizardPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';

const NAV = [
  { path: '/',        icon: '✦', label: '广场' },
  { path: '/mine',    icon: '♡', label: '我的' },
  { path: '/profile', icon: '◎', label: '设置' },
];

const HIDE_NAV = ['/wizard', '/chat/'];

export default function App() {
  const { user, loading, error, updateCredits, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0d0d12', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>💋</div>
        <div style={{
          fontSize: 13, letterSpacing: 4, fontWeight: 300,
          background: 'linear-gradient(135deg,#ff3d7f,#c026d3)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>私欲玩伴</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0d0d12', padding: 24,
      }}>
        <div style={{ textAlign: 'center', color: '#606070' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: '#f0f0f8' }}>{error}</div>
        </div>
      </div>
    );
  }

  const hideNav = HIDE_NAV.some(p => location.pathname.startsWith(p));

  return (
    <div className="app">
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/mine" element={<MyCharsPage user={user!} />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/chat/:characterId" element={<ChatPage user={user!} onCreditsUpdate={updateCredits} />} />
          <Route path="/profile" element={<ProfilePage user={user!} setUser={setUser} />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      {!hideNav && (
        <nav className="nav-bar">
          {NAV.map(item => {
            const active = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="icon">{item.icon}</span>
                <span>{item.label}</span>
                {active && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
