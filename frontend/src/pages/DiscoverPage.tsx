import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character } from '../types';

const CATEGORIES = ['全部', '御姐', '学妹', '人妻', '调教', '修仙', '妖魔', '特殊'];

const GRADIENTS = [
  'linear-gradient(145deg, #2d0a3e, #6b1560)',
  'linear-gradient(145deg, #0a1a3e, #1a3a6e)',
  'linear-gradient(145deg, #3e0a0a, #6e2020)',
  'linear-gradient(145deg, #0a2e1a, #1a5030)',
  'linear-gradient(145deg, #1a0a3e, #4a1060)',
  'linear-gradient(145deg, #2e1a0a, #5a3010)',
  'linear-gradient(145deg, #0a2a2e, #104050)',
  'linear-gradient(145deg, #2e0a20, #601040)',
];

function cardGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function matchesCategory(char: Character, cat: string): boolean {
  if (cat === '全部') return true;
  const text = `${char.personality} ${char.occupation} ${char.background}`.toLowerCase();
  const map: Record<string, string[]> = {
    '御姐': ['御姐', '成熟', '气质', '优雅', '知性', '强势'],
    '学妹': ['学生', '大学', '学妹', '18', '19', '20', '21', '清纯'],
    '人妻': ['人妻', '妻', '已婚', '家庭主妇', '主妇'],
    '调教': ['调教', '驯服', '服从', '支配', '控制', '女仆'],
    '修仙': ['修仙', '仙', '道', '灵', '法力', '宗门', '弟子'],
    '妖魔': ['妖', '魔', '鬼', '恶魔', '精灵', '狐狸', '蛇'],
    '特殊': ['护士', '教师', '老师', '侦探', '间谍', '神秘'],
  };
  return (map[cat] || []).some(kw => text.includes(kw.toLowerCase()));
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function DiscoverPage() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [category, setCategory] = useState('全部');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (s: string, srt: string, p: number) => {
    setLoading(true);
    try {
      const data = await api.marketplace.list({ sort: srt, search: s || undefined, page: p });
      setCharacters(p === 1 ? data.characters : prev => [...prev, ...data.characters]);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setPage(1); load(search, sort, 1); }, [sort]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(search, sort, 1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const displayed = category === '全部'
    ? characters
    : characters.filter(c => matchesCategory(c, category));

  const featured = characters.filter(c => c.usageCount > 0).slice(0, 8);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header-accent">
        <div className="page-title-lg">私欲<span>广场</span></div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/wizard')} style={{ gap: 4 }}>
          ＋ 创建
        </button>
      </div>

      {/* Search */}
      <div className="search-wrap" style={{ paddingTop: 12 }}>
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-hint)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="搜索名字、职业、性格..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-hint)', cursor: 'pointer', fontSize: 16, padding: 0 }}>×</button>
          )}
        </div>
      </div>

      {/* Featured section - only show when not searching */}
      {!search && featured.length > 0 && (
        <>
          <div className="section-header">
            <div className="section-header-title">今日推荐</div>
          </div>
          <div className="featured-scroll">
            {featured.map(char => (
              <div key={char.id} className="featured-card" onClick={() => navigate(`/chat/${char.id}`)}>
                <div className="featured-card-img" style={{ background: cardGradient(char.id) }}>
                  <div className="char-card-glow" />
                  <span className="featured-card-emoji">{char.avatarEmoji}</span>
                  <div className="featured-card-overlay">
                    <div className="featured-card-name">{char.name}</div>
                    <div className="featured-card-meta">{char.age}岁 · {char.occupation}</div>
                  </div>
                  {char.usageCount >= 50 && (
                    <div className="hot-badge">🔥 热</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sort tabs */}
      {!search && (
        <div className="tabs" style={{ marginTop: 4 }}>
          <button className={`tab ${sort === 'popular' ? 'active' : ''}`} onClick={() => setSort('popular')}>最热门</button>
          <button className={`tab ${sort === 'rating' ? 'active' : ''}`} onClick={() => setSort('rating')}>最高分</button>
          <button className={`tab ${sort === 'newest' ? 'active' : ''}`} onClick={() => setSort('newest')}>最新</button>
        </div>
      )}

      {/* Category pills */}
      <div className="pill-scroll">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`pill ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {displayed.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="emoji">🌸</div>
          <div>还没有角色，快去创建吧</div>
          <button className="btn btn-primary" onClick={() => navigate('/wizard')}>创建角色</button>
        </div>
      ) : (
        <div className="char-grid">
          {displayed.map(char => (
            <CharCard key={char.id} char={char} gradient={cardGradient(char.id)} onClick={() => navigate(`/chat/${char.id}`)} />
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-hint)', fontSize: 13 }}>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            <span style={{ animation: 'pulse 1s infinite' }}>·</span>
            <span style={{ animation: 'pulse 1s 0.2s infinite' }}>·</span>
            <span style={{ animation: 'pulse 1s 0.4s infinite' }}>·</span>
          </div>
        </div>
      )}

      {!loading && characters.length < total && (
        <div style={{ padding: '0 12px 20px' }}>
          <button className="btn btn-secondary btn-full" onClick={() => { const n = page + 1; setPage(n); load(search, sort, n); }}>
            加载更多
          </button>
        </div>
      )}

      <div style={{ height: 8 }} />
    </div>
  );
}

function CharCard({ char, gradient, onClick }: { char: Character; gradient: string; onClick: () => void }) {
  const isHot = char.usageCount >= 50;

  return (
    <div className="char-card" onClick={onClick}>
      {isHot && <div className="hot-badge">🔥 热</div>}
      <div className="char-card-img" style={{ background: gradient }}>
        <div className="char-card-glow" />
        <span className="char-card-emoji">{char.avatarEmoji}</span>
        <div className="char-card-overlay">
          <div className="char-card-overlay-name">{char.name}</div>
          <div className="char-card-overlay-age">{char.age}岁</div>
        </div>
      </div>
      <div className="char-card-info">
        <div className="char-card-occ">{char.occupation}</div>
        <div className="char-card-footer">
          {char.reviewCount > 0 ? (
            <span className="char-card-rating">★ {char.avgRating.toFixed(1)}</span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>新角色</span>
          )}
          <span className="char-card-usage">💬 {formatCount(char.usageCount)}</span>
        </div>
      </div>
    </div>
  );
}
