import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character } from '../types';

// 每个角色精确归类（硬编码，不依赖文本模糊匹配）
const CHARACTER_CATEGORY: Record<string, string> = {
  // 御姐：冷艳自信
  '沈静': '御姐', '唐诗': '御姐',
  // 学妹：年轻活泼
  '晓彤': '学妹', '娜娜': '学妹', '小雨': '学妹',
  '琉璃': '学妹', '晴晴': '学妹', '阿柒': '学妹', '糖糖': '学妹',
  // 禁忌：职业身份禁忌（老师/护士/暗黑）
  '椎名老师': '禁忌', '小慧': '禁忌', '夜玲': '禁忌',
  // 妖魔：妖/魔
  '狐九': '妖魔', '魅罗': '妖魔', '冷霜': '妖魔',
  // 科幻：赛博/AI
  'X-23': '科幻', '幻音': '科幻',
};

const CATEGORIES = ['全部', '御姐', '学妹', '禁忌', '妖魔', '科幻'];

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
        padding: '18px 16px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(180deg, rgba(60,10,80,0.6) 0%, transparent 100%)',
        flexShrink: 0,
      }}>
        {/* Logo 文字徽标 */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #ff3d7f, #c026d3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, boxShadow: '0 2px 12px rgba(255,61,127,0.4)',
        }}>💋</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            私欲<span style={{ color: 'var(--accent)' }}>广场</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1 }}>发现你的专属陪伴</div>
        </div>
      </div>

      {/* Search */}
      <div className="search-wrap">
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
          <div>暂无角色</div>
        </div>
      ) : (
        <div className="char-grid">
          {displayed.map(char => (
            <CharCard key={char.id} char={char} gradient={cardGradient(char.id)} onClick={() => navigate(`/character/${char.id}`)} />
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
  const [imgErr, setImgErr] = useState(false);
  const hasPortrait = char.portraitUrl && !imgErr;

  return (
    <div className="char-card" onClick={onClick}>
      {isHot && <div className="hot-badge">🔥 热</div>}
      <div className="char-card-img" style={{ background: gradient }}>
        {hasPortrait ? (
          <img
            src={char.portraitUrl!}
            alt={char.name}
            onError={() => setImgErr(true)}
          />
        ) : (
          <>
            <div className="char-card-glow" />
            <span className="char-card-emoji">{char.avatarEmoji}</span>
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
