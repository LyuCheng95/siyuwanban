import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { DiscoverPage } from './pages/DiscoverPage';
import { MyCharsPage } from './pages/MyCharsPage';
import { WizardPage } from './pages/WizardPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';

const NAV = [
  {
    path: '/',
    label: '广场',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#grad)' : 'none'} stroke={active ? 'url(#grad)' : 'currentColor'} strokeWidth="1.8">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff3d7f"/>
            <stop offset="100%" stopColor="#c026d3"/>
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    )
  },
  {
    path: '/mine',
    label: '我的角色',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#grad2)' : 'none'} stroke={active ? 'url(#grad2)' : 'currentColor'} strokeWidth="1.8">
        <defs>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff3d7f"/>
            <stop offset="100%" stopColor="#c026d3"/>
          </linearGradient>
        </defs>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    path: '/profile',
    label: '我的',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#grad3)' : 'none'} stroke={active ? 'url(#grad3)' : 'currentColor'} strokeWidth="1.8">
        <defs>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff3d7f"/>
            <stop offset="100%" stopColor="#c026d3"/>
          </linearGradient>
        </defs>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
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
                {item.icon(active)}
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
