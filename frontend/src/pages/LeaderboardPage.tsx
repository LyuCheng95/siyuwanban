import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character } from '../types';

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'usage' | 'rating'>('usage');
  const [data, setData] = useState<{ byUsage: Character[]; byRating: Character[] } | null>(null);

  useEffect(() => {
    api.marketplace.leaderboard().then(setData).catch(console.error);
  }, []);

  const list = tab === 'usage' ? (data?.byUsage ?? []) : (data?.byRating ?? []);

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="section-title">🏆 排行榜</div>

      <div className="tabs">
        <button className={`tab ${tab === 'usage' ? 'active' : ''}`} onClick={() => setTab('usage')}>
          最受欢迎
        </button>
        <button className={`tab ${tab === 'rating' ? 'active' : ''}`} onClick={() => setTab('rating')}>
          最高评分
        </button>
      </div>

      {!data ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-hint)' }}>加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🏆</div>
          <div>暂无数据，快来创建角色吧</div>
        </div>
      ) : (
        list.map((char, i) => (
          <div key={char.id} className="leaderboard-item" onClick={() => navigate(`/chat/${char.id}`)}
            style={{ cursor: 'pointer' }}>
            <div className={`rank-badge ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n'}`}>
              {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
            </div>
            <div style={{ fontSize: 28 }}>{char.avatarEmoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{char.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>
                {char.occupation} · by {char.creator?.firstName || char.creator?.username || '匿名'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {tab === 'usage' ? (
                <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{char.usageCount}次</div>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, color: '#f59e0b' }}>⭐ {char.avgRating.toFixed(1)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{char.reviewCount}评价</div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
