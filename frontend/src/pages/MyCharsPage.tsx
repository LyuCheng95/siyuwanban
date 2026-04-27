import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { api } from '../api/client';
import type { Character, User } from '../types';

interface Props {
  user: User;
}

export function MyCharsPage({ user }: Props) {
  const navigate = useNavigate();
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.characters.mine().then(setChars).finally(() => setLoading(false));
  }, []);

  const displayName = user.firstName || user.username || '你';

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '20px 14px 8px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
          欢迎回来，{displayName} 👋
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>我的角色</div>
      </div>

      {/* Credits bar */}
      <div style={{
        margin: '0 12px 16px',
        padding: '14px 16px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>剩余对话次数</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>
            {user.freeCredits + user.paidCredits}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)', marginLeft: 4 }}>次</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>
          <div>💚 免费 {user.freeCredits}</div>
          <div style={{ marginTop: 2 }}>⭐ 已购 {user.paidCredits}</div>
        </div>
      </div>

      {/* Create button */}
      <div style={{ padding: '0 12px 16px' }}>
        <button
          className="btn btn-primary btn-full"
          style={{ borderRadius: 'var(--radius)' }}
          onClick={() => navigate('/wizard')}
        >
          ✦ 创建新角色
        </button>
      </div>

      {/* Character list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-hint)' }}>加载中...</div>
      ) : chars.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🌸</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有创建角色</div>
          <div style={{ fontSize: 13 }}>去广场发现现成的角色，或者创建专属于你的她</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>去广场</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/wizard')}>创建</button>
          </div>
        </div>
      ) : (
        <>
          {chars.map(char => (
            <MyCharCard key={char.id} char={char} onChat={() => navigate(`/chat/${char.id}`)} onDelete={() => {
              api.characters.delete(char.id).catch(() => {});
              setChars(prev => prev.filter(c => c.id !== char.id));
            }} />
          ))}
        </>
      )}
    </div>
  );
}

function MyCharCard({ char, onChat, onDelete }: { char: Character; onChat: () => void; onDelete: () => void }) {
  function confirmDelete() {
    WebApp.showConfirm(`确定删除「${char.name}」？所有对话记录也会删除。`, (ok) => { if (ok) onDelete(); });
  }

  return (
    <div style={{
      margin: '0 12px 10px',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 12px', cursor: 'pointer' }}
        onClick={onChat}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3d1a4a, #7c1a6a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>{char.avatarEmoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{char.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {char.age}岁 · {char.occupation}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
            {char.isPublic ? '🌍 公开' : '🔒 私密'} · 被聊 {char.usageCount} 次
            {char.reviewCount > 0 && ` · ★${char.avgRating.toFixed(1)}`}
          </div>
        </div>
        <div style={{ color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>›</div>
      </div>

      <div style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={onChat}
          style={{
            flex: 1, padding: '10px', background: 'none', border: 'none',
            color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          💬 继续聊天
        </button>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <button
          onClick={confirmDelete}
          style={{
            width: 48, padding: '10px', background: 'none', border: 'none',
            color: 'var(--text-hint)', fontSize: 16, cursor: 'pointer',
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

