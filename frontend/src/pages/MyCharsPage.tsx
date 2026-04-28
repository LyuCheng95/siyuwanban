import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ChatHistoryItem, User } from '../types';

interface Props { user: User; }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}个月前`;
}

function intimacyLabel(n: number): string {
  if (n < 20) return '初识';
  if (n < 40) return '熟悉';
  if (n < 60) return '亲近';
  if (n < 80) return '亲密';
  if (n < 95) return '深爱';
  return '灵魂伴侣';
}

function intimacyColor(n: number): string {
  if (n < 30) return '#6366f1';
  if (n < 60) return '#a855f7';
  if (n < 85) return '#ec4899';
  return '#ff3d7f';
}

export function MyCharsPage({ user }: Props) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.conversations.list()
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '20px 14px 8px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>
            {user.firstName || '你'} 的聊天
          </div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>聊天记录</div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/')}
          style={{ marginBottom: 4 }}
        >+ 发现角色</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-hint)' }}>加载中...</div>
      ) : history.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <div className="emoji">💬</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>还没有聊天记录</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>去广场找一个她，开始你们的故事</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>去广场</button>
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {history.map(item => (
            <HistoryCard
              key={item.id}
              item={item}
              onClick={() => navigate(`/chat/${item.character.id}`)}
              onProfile={() => navigate(`/character/${item.character.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, onClick, onProfile }: {
  item: ChatHistoryItem;
  onClick: () => void;
  onProfile: () => void;
}) {
  const { character, lastMessage, mood, intimacy, updatedAt, totalTurns } = item;
  const preview = lastMessage
    ? (lastMessage.role === 'user' ? '你：' : '') + lastMessage.content.slice(0, 40) + (lastMessage.content.length > 40 ? '…' : '')
    : '点击继续聊天';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: 'transparent',
        transition: 'background 0.15s',
      }}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        style={{
          position: 'relative', flexShrink: 0,
          width: 52, height: 52,
        }}
        onClick={e => { e.stopPropagation(); onProfile(); }}
      >
        {character.portraitUrl ? (
          <img
            src={character.portraitUrl}
            alt={character.name}
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3d1a4a, #7c1a6a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>{character.avatarEmoji}</div>
        )}
        {/* Online dot */}
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 10, height: 10, borderRadius: '50%',
          background: '#4ade80', border: '2px solid var(--bg)',
          boxShadow: '0 0 4px rgba(74,222,128,0.7)',
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{character.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0, marginLeft: 8 }}>
            {timeAgo(updatedAt)}
          </div>
        </div>
        <div style={{
          fontSize: 13, color: 'var(--text-2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 4,
        }}>{preview}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Intimacy pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: intimacyColor(intimacy),
            background: `${intimacyColor(intimacy)}18`,
            border: `1px solid ${intimacyColor(intimacy)}30`,
            borderRadius: 10, padding: '2px 7px',
          }}>
            <span>💛</span>
            <span>{intimacyLabel(intimacy)}</span>
            <span style={{ opacity: 0.6 }}>{intimacy}</span>
          </div>
          {/* Mood */}
          <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{mood}</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-hint)' }}>
            {totalTurns}轮
          </div>
        </div>
      </div>

      <div style={{ color: 'var(--text-hint)', fontSize: 18, flexShrink: 0, marginLeft: 4 }}>›</div>
    </div>
  );
}
