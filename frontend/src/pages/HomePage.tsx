import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character, User } from '../types';

export function HomePage({ user }: { user: User }) {
  const navigate = useNavigate();
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.characters.mine().then(setMyChars).catch(console.error).finally(() => setLoading(false));
  }, []);

  const greeting = user.firstName ? `你好，${user.firstName} 👋` : '你好 👋';
  const credits = user.freeCredits + user.paidCredits;

  return (
    <div className="page" style={{ paddingTop: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{greeting}</div>
        <div style={{ color: 'var(--text-hint)', fontSize: 13, marginTop: 4 }}>
          剩余对话次数：
          <span style={{ color: user.freeCredits > 0 ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
            {credits}次
          </span>
          {user.freeCredits > 0 && (
            <span style={{ color: 'var(--text-hint)' }}> (含{user.freeCredits}次免费)</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate('/wizard')}>
          ✨ 创建角色
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/marketplace')}>
          🌟 角色广场
        </button>
      </div>

      <div className="section-title">我的角色</div>

      {loading ? (
        <div style={{ color: 'var(--text-hint)', textAlign: 'center', padding: 24 }}>加载中...</div>
      ) : myChars.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🤗</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有角色</div>
          <div>点击「创建角色」，让AI引导你设计专属陪伴</div>
          <button className="btn btn-primary" onClick={() => navigate('/wizard')}>
            开始创建
          </button>
        </div>
      ) : (
        myChars.map(char => (
          <CharacterCard key={char.id} character={char} onClick={() => navigate(`/chat/${char.id}`)} />
        ))
      )}
    </div>
  );
}

function CharacterCard({ character, onClick }: { character: Character; onClick: () => void }) {
  return (
    <div className="character-card" onClick={onClick}>
      <div className="character-avatar">{character.avatarEmoji}</div>
      <div className="character-info">
        <div className="character-name">{character.name}</div>
        <div className="character-meta">
          {character.age}岁 · {character.gender} · {character.occupation}
        </div>
        <div className="character-meta" style={{ marginTop: 2 }}>
          {character.personality.split(/[，,、]/).slice(0, 3).join(' · ')}
        </div>
      </div>
      <div style={{ color: 'var(--accent)', fontSize: 20 }}>›</div>
    </div>
  );
}
