import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useLang } from './hooks/useLang';
import { DiscoverPage } from './pages/DiscoverPage';
import { MyCharsPage } from './pages/MyCharsPage';
import { ChatPage } from './pages/ChatPage';
import { CharacterProfilePage } from './pages/CharacterProfilePage';
import { ProfilePage } from './pages/ProfilePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { CheckInModal } from './components/CheckInModal';
import { NicknameModal } from './components/NicknameModal';
import { AuthPage } from './pages/AuthPage';

const NAV_PATHS = [
  {
    path: '/',
    key: 'discover' as const,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#grad)' : 'none'} stroke={active ? 'url(#grad)' : 'currentColor'} strokeWidth="1.8">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8356c"/>
            <stop offset="100%" stopColor="#9a1258"/>
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
    key: 'home' as const,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#grad2)' : 'none'} stroke={active ? 'url(#grad2)' : 'currentColor'} strokeWidth="1.8">
        <defs>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8356c"/>
            <stop offset="100%" stopColor="#9a1258"/>
          </linearGradient>
        </defs>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  },
  {
    path: '/profile',
    key: 'profile' as const,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'url(#grad3)' : 'none'} stroke={active ? 'url(#grad3)' : 'currentColor'} strokeWidth="1.8">
        <defs>
          <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8356c"/>
            <stop offset="100%" stopColor="#9a1258"/>
          </linearGradient>
        </defs>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    )
  },
];

const HIDE_NAV = ['/chat/', '/character/'];
const CHECKIN_KEY = 'sywb_last_checkin_shown';

export default function App() {
  const { user, loading, error, needsAuth, handleAuthSuccess, continueAsGuest, updateCredits, setUser } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [nicknameSkipped, setNicknameSkipped] = useState(() => !!localStorage.getItem('nickname_skipped'));

  useEffect(() => {
    if (!user) return;
    const lastShown = localStorage.getItem(CHECKIN_KEY);
    const today = new Date().toDateString();
    if (lastShown !== today) {
      const t = setTimeout(() => {
        setShowCheckIn(true);
        localStorage.setItem(CHECKIN_KEY, today);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [user]);

  function handleCheckInClose(gold: number, diamonds: number) {
    setShowCheckIn(false);
    // -1 sentinel means modal was dismissed without checking in — don't overwrite credits
    if (gold >= 0 && diamonds >= 0) {
      updateCredits(gold, diamonds);
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#09090f', flexDirection: 'column', gap: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e8356c, #9a1258)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 32px rgba(232,53,108,0.4)',
        }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div style={{
          fontSize: 11, letterSpacing: 6, fontWeight: 400,
          background: 'linear-gradient(135deg,#e8356c,#9a1258)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textTransform: 'uppercase',
        }}>私欲玩伴</div>
      </div>
    );
  }

  if (needsAuth) {
    return <AuthPage onSuccess={handleAuthSuccess} onGuest={continueAsGuest} />;
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#09090f', padding: 24,
      }}>
        <div style={{ textAlign: 'center', color: '#606070' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ color: '#eee8f6' }}>{error}</div>
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
<Route path="/character/:characterId" element={<CharacterProfilePage />} />
          <Route path="/chat/:characterId" element={<ChatPage user={user!} onCreditsUpdate={updateCredits} />} />
          <Route path="/profile" element={<ProfilePage user={user!} setUser={setUser} />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      {!hideNav && (
        <nav className="nav-bar">
          {NAV_PATHS.map(item => {
            const active = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigate(item.path, { replace: true })}
              >
                {item.icon(active)}
                <span>{t.nav[item.key]}</span>
                {active && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>
      )}

      {showCheckIn && <CheckInModal onClose={handleCheckInClose} />}

      {user && !user.nickname && !showCheckIn && !nicknameSkipped && (
        <NicknameModal
          onDone={nickname => setUser(prev => prev ? { ...prev, nickname } : prev)}
          onSkip={() => { localStorage.setItem('nickname_skipped', '1'); setNicknameSkipped(true); }}
        />
      )}
    </div>
  );
}
