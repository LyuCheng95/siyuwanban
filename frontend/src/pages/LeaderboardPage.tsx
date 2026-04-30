import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLang } from '../hooks/useLang';
import { charField } from '../i18n';
import type { Character } from '../types';

function CharInitial({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2a0840, #6a1060)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
      flexShrink: 0,
    }}>
      {name.slice(0, 1)}
    </div>
  );
}

const RANK_COLORS = ['#c49038', '#8090a8', '#b86040'];

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [tab, setTab] = useState<'usage' | 'rating'>('usage');
  const [data, setData] = useState<{ byUsage: Character[]; byRating: Character[] } | null>(null);

  useEffect(() => {
    api.marketplace.leaderboard().then(setData).catch(console.error);
  }, []);

  const list = tab === 'usage' ? (data?.byUsage ?? []) : (data?.byRating ?? []);

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="section-title">{t.leaderboard.title}</div>

      <div className="tabs">
        <button className={`tab ${tab === 'usage' ? 'active' : ''}`} onClick={() => setTab('usage')}>
          {t.leaderboard.byUsage}
        </button>
        <button className={`tab ${tab === 'rating' ? 'active' : ''}`} onClick={() => setTab('rating')}>
          {t.leaderboard.byRating}
        </button>
      </div>

      {!data ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-hint)' }}>{t.common.loading}</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-hint)' }}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div>{t.leaderboard.empty}</div>
        </div>
      ) : (
        list.map((char, i) => {
          const displayName = charField(char.nameEn, char.name);
          const displayOcc = charField(char.occupationEn, char.occupation);
          const creatorName = char.creator?.firstName || char.creator?.username || t.leaderboard.anon;
          return (
            <div key={char.id} className="leaderboard-item" onClick={() => navigate(`/chat/${char.id}`)}
              style={{ cursor: 'pointer' }}>
              <div className={`rank-badge ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n'}`}
                style={i < 3 ? { color: RANK_COLORS[i], fontWeight: 800 } : {}}>
                {i + 1}
              </div>
              {char.portraitUrl
                ? <img src={char.portraitUrl} alt={displayName} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} />
                : <CharInitial name={char.name} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                  {displayOcc} · by {creatorName}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {tab === 'usage' ? (
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{char.usageCount} {t.leaderboard.chats}</div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>{char.avgRating.toFixed(1)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{char.reviewCount} {t.profile.reviews}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
