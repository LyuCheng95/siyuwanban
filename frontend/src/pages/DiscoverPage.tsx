import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character } from '../types';

const CATEGORIES = ['全部', '御姐', '学妹', '人妻', '职场', '邻家', '萌系', '特殊'];

const GRADIENTS = [
  'linear-gradient(145deg, #3d1a4a, #7c1a6a)',
  'linear-gradient(145deg, #1a2a4a, #1a4a6a)',
  'linear-gradient(145deg, #4a1a1a, #7c2a2a)',
  'linear-gradient(145deg, #1a3a2a, #2a5a3a)',
  'linear-gradient(145deg, #2a1a4a, #5a1a7c)',
  'linear-gradient(145deg, #3a2a1a, #6a4a1a)',
];

function cardGradient(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function matchesCategory(char: Character, cat: string): boolean {
  if (cat === '全部') return true;
  const text = `${char.personality} ${char.occupation} ${char.background}`.toLowerCase();
  const map: Record<string, string[]> = {
    '御姐': ['御姐', '成熟', '气质', '优雅', '知性'],
    '学妹': ['学生', '大学', '学妹', '18', '19', '20', '21'],
    '人妻': ['人妻', '妻', '已婚', '家庭主妇', '主妇'],
    '职场': ['秘书', '职场', '白领', '精英', '主管', '经理'],
    '邻家': ['邻家', '青梅', '朋友', '普通', '温柔', '可爱'],
    '萌系': ['萌', '可爱', '元气', '活泼', '甜美'],
    '特殊': ['护士', '教师', '老师', '模特', '主播', '艺术'],
  };
  return (map[cat] || []).some(kw => text.includes(kw.toLowerCase()));
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

  const topChars = characters.filter(c => c.usageCount > 50).slice(0, 6);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">私欲广场</div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/wizard')}
          style={{ gap: 4 }}
        >
          ＋ 创建
        </button>
      </div>

      {/* Search */}
      <div className="search-wrap">
        <div className="search-bar">
          <span style={{ color: 'var(--text-hint)', fontSize: 16 }}>🔍</span>
          <input
            placeholder="搜索名字、职业、性格..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-hint)', cursor: 'pointer', fontSize: 16, padding: 0 }}
            >×</button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="pill-scroll">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`pill ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
            {cat}
          </button>
        ))}
      </div>

      {/* Sort tabs */}
      {!search && (
        <div className="tabs" style={{ marginTop: 8 }}>
          <button className={`tab ${sort === 'popular' ? 'active' : ''}`} onClick={() => setSort('popular')}>最热门</button>
          <button className={`tab ${sort === 'rating' ? 'active' : ''}`} onClick={() => setSort('rating')}>最高分</button>
          <button className={`tab ${sort === 'newest' ? 'active' : ''}`} onClick={() => setSort('newest')}>最新</button>
        </div>
      )}

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
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-hint)', fontSize: 13 }}>加载中...</div>
      )}

      {!loading && characters.length < total && (
        <div style={{ padding: '0 12px 16px' }}>
          <button className="btn btn-secondary btn-full" onClick={() => { const n = page + 1; setPage(n); load(search, sort, n); }}>
            加载更多
          </button>
        </div>
      )}
    </div>
  );
}

function CharCard({ char, gradient, onClick }: { char: Character; gradient: string; onClick: () => void }) {
  const tags = char.personality.split(/[、,，\s]+/).filter(Boolean).slice(0, 3);
  const isHot = char.usageCount >= 50;

  return (
    <div className="char-card" onClick={onClick}>
      {isHot && <div className="hot-badge">🔥 热</div>}
      <div className="char-card-top" style={{ background: gradient }}>
        <span style={{ position: 'relative', zIndex: 1 }}>{char.avatarEmoji}</span>
      </div>
      <div className="char-card-body">
        <div className="char-card-name">{char.name}</div>
        <div className="char-card-meta">{char.age}岁 · {char.occupation}</div>
        <div className="char-tags">
          {tags.map((t, i) => <span key={i} className="char-tag">{t}</span>)}
        </div>
        <div className="char-card-footer">
          {char.reviewCount > 0 ? (
            <span style={{ color: '#fbbf24', fontSize: 11 }}>★{char.avgRating.toFixed(1)}</span>
          ) : (
            <span>新角色</span>
          )}
          <span>💬 {char.usageCount}</span>
        </div>
      </div>
    </div>
  );
}
