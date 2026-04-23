import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { HomePage } from './pages/HomePage';
import { WizardPage } from './pages/WizardPage';
import { ChatPage } from './pages/ChatPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';

const NAV = [
  { path: '/',           icon: '💬', label: '我的' },
  { path: '/marketplace', icon: '🌟', label: '广场' },
  { path: '/leaderboard', icon: '🏆', label: '榜单' },
  { path: '/profile',    icon: '👤', label: '我' },
];

export default function App() {
  const { user, loading, error, updateCredits, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-hint)' }}>
          <div style={{ fontSize: 40 }}>💫</div>
          <div style={{ marginTop: 12 }}>私欲玩伴</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-hint)' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ marginTop: 12, color: 'var(--text)' }}>{error}</div>
        </div>
      </div>
    );
  }

  const hiddenNavPaths = ['/wizard', '/chat/'];
  const hideNav = hiddenNavPaths.some(p => location.pathname.startsWith(p));

  return (
    <div className="app">
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<HomePage user={user!} />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/chat/:characterId" element={<ChatPage user={user!} onCreditsUpdate={updateCredits} />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/profile" element={<ProfilePage user={user!} setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      {!hideNav && (
        <nav className="nav-bar">
          {NAV.map(item => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
