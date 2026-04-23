import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character } from '../types';

const SORTS = [
  { value: 'popular', label: '最热门' },
  { value: 'rating',  label: '最高评分' },
  { value: 'newest',  label: '最新' },
];

export function MarketplacePage() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    setPage(1);
    load(search, sort, 1);
  }, [sort]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(search, sort, 1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    load(search, sort, next);
  }

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      <div className="section-title">角色广场</div>

      {/* Search */}
      <div className="search-bar">
        <span style={{ color: 'var(--text-hint)' }}>🔍</span>
        <input
          placeholder="搜索角色名、职业、性格..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ background: 'none', border: 'none', color: 'var(--text-hint)', cursor: 'pointer', fontSize: 16 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Sort tabs */}
      <div className="tabs">
        {SORTS.map(s => (
          <button key={s.value} className={`tab ${sort === s.value ? 'active' : ''}`} onClick={() => setSort(s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      {characters.length === 0 && !loading ? (
        <div className="empty-state">
          <div className="emoji">🔍</div>
          <div>没有找到匹配的角色</div>
        </div>
      ) : (
        characters.map(char => (
          <MarketCharacterCard key={char.id} character={char} onClick={() => navigate(`/chat/${char.id}`)} />
        ))
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-hint)' }}>加载中...</div>
      )}

      {!loading && characters.length < total && (
        <button className="btn btn-secondary btn-full" style={{ marginTop: 8 }} onClick={loadMore}>
          加载更多
        </button>
      )}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  );
}

function MarketCharacterCard({ character, onClick }: { character: Character; onClick: () => void }) {
  return (
    <div className="character-card" onClick={onClick}>
      <div className="character-avatar">{character.avatarEmoji}</div>
      <div className="character-info">
        <div className="character-name">{character.name}</div>
        <div className="character-meta">{character.age}岁 · {character.gender} · {character.occupation}</div>
        <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
          {character.reviewCount > 0 ? (
            <div className="rating-row">
              <Stars rating={character.avgRating} />
              <span style={{ color: 'var(--text-hint)', fontSize: 11 }}>
                {character.avgRating.toFixed(1)} ({character.reviewCount})
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>暂无评分</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>💬 {character.usageCount}</span>
        </div>
      </div>
      <div style={{ color: 'var(--accent)', fontSize: 20 }}>›</div>
    </div>
  );
}
