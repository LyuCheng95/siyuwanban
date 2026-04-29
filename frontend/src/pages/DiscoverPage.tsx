import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character } from '../types';

const CHARACTER_CATEGORY: Record<string, string> = {
  '沈静': '御姐', '唐诗': '御姐',
  '晓彤': '学妹', '娜娜': '学妹', '小雨': '学妹',
  '琉璃': '学妹', '晴晴': '学妹', '阿柒': '学妹', '糖糖': '学妹',
  '椎名老师': '禁忌', '小慧': '禁忌', '夜玲': '禁忌',
  '狐九': '妖魔', '魅罗': '妖魔', '冷霜': '妖魔',
  'X-23': '科幻', '幻音': '科幻',
};

const CATEGORIES = ['全部', '御姐', '学妹', '禁忌', '妖魔', '科幻'];

const GRADIENTS = [
  'linear-gradient(160deg, #2d0a3e, #6b1560)',
  'linear-gradient(160deg, #0a1a3e, #1a3a6e)',
  'linear-gradient(160deg, #3e0a0a, #6e2020)',
  'linear-gradient(160deg, #0a2e1a, #1a5030)',
  'linear-gradient(160deg, #1a0a3e, #4a1060)',
  'linear-gradient(160deg, #2e1a0a, #5a3010)',
  'linear-gradient(160deg, #0a2a2e, #104050)',
  'linear-gradient(160deg, #2e0a20, #601040)',
];

function cardGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function matchesCategory(char: Character, cat: string): boolean {
  if (cat === '全部') return true;
  return CHARACTER_CATEGORY[char.name] === cat;
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
    } catch (err) {
      console.error('Failed to load characters:', err);
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

  return (
    <div className="page">
      {/* Header */}
      <div style={{
        padding: '16px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, #ff3d7f, #c026d3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(255,61,127,0.35)',
          }}>
            <span style={{ color: 'white', fontWeight: 900, fontSize: 13, letterSpacing: '-0.5px' }}>私欲</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px', lineHeight: 1.1 }}>
              角色<span style={{ color: 'var(--accent)' }}>广场</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1 }}>发现你的专属陪伴</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', fontWeight: 500 }}>
          {total > 0 && `${total} 位`}
        </div>
      </div>

      {/* Search */}
      <div className="search-wrap">
        <div className="search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: 'var(--text-hint)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="搜索名字、职业、性格..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--text-hint)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* Sort tabs */}
      {!search && (
        <div className="tabs" style={{ marginTop: 6 }}>
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
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-hint)' }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-hint)' }}>暂无角色</div>
        </div>
      ) : (
        <div className="char-grid">
          {displayed.map(char => (
            <CharCard key={char.id} char={char} gradient={cardGradient(char.id)} onClick={() => navigate(`/character/${char.id}`)} />
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-hint)', fontSize: 13 }}>
          <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
            {[0, 0.15, 0.3].map((delay, i) => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)',
                display: 'inline-block',
                animation: `pulse 1s ${delay}s ease-in-out infinite`,
                opacity: 0.6,
              }} />
            ))}
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
  const [imgErr, setImgErr] = useState(false);
  const hasPortrait = char.portraitUrl && !imgErr;

  return (
    <div className="char-card" onClick={onClick}>
      {isHot && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 4,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
          background: 'linear-gradient(135deg, #ff3d7f, #c026d3)',
          color: 'white', padding: '3px 8px', borderRadius: 20,
        }}>热门</div>
      )}
      <div className="char-card-img" style={{ background: gradient }}>
        {hasPortrait ? (
          <img src={char.portraitUrl!} alt={char.name} onError={() => setImgErr(true)} />
        ) : (
          <>
            <div className="char-card-glow" />
            <span style={{
              fontSize: 42, fontWeight: 900, color: 'rgba(255,255,255,0.18)',
              fontFamily: 'sans-serif', letterSpacing: -2, userSelect: 'none',
              position: 'relative', zIndex: 2,
            }}>{char.name.slice(0, 1)}</span>
          </>
        )}
        <div className="char-card-overlay">
          <div className="char-card-overlay-name">{char.name}</div>
          <div className="char-card-overlay-age">{char.age}岁</div>
        </div>
      </div>
      <div className="char-card-info">
        <div className="char-card-occ">{char.occupation}</div>
        {char.background && (
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', marginTop: 3, marginBottom: 2,
          }}>
            {char.background}
          </div>
        )}
        <div className="char-card-footer">
          {char.reviewCount > 0 ? (
            <span className="char-card-rating">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 2, marginBottom: 1 }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {char.avgRating.toFixed(1)}
            </span>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--text-hint)', fontWeight: 500 }}>新角色</span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-hint)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {formatCount(char.usageCount)}
          </span>
        </div>
      </div>
    </div>
  );
}
