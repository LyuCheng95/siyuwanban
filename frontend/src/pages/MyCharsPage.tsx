import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLang } from '../hooks/useLang';
import { charField } from '../i18n';
import type { ChatHistoryItem, User } from '../types';
import type { Lang } from '../i18n';

interface Props { user: User; }

function timeAgo(dateStr: string, lang: Lang = 'zh'): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (lang === 'en') {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}个月前`;
}

function intimacyLabel(n: number, lang: Lang = 'zh'): string {
  if (lang === 'en') {
    if (n < 20) return 'Acquaintance';
    if (n < 40) return 'Familiar';
    if (n < 60) return 'Close';
    if (n < 80) return 'Intimate';
    if (n < 95) return 'Devoted';
    return 'Soulmate';
  }
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
  return '#e8356c';
}

function CharInitial({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2a0840, #6a1060)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
      letterSpacing: 0,
    }}>
      {name.slice(0, 1)}
    </div>
  );
}

export function MyCharsPage({ user }: Props) {
  const navigate = useNavigate();
  const { t, lang } = useLang();
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
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {user.firstName || (lang === 'en' ? 'Your' : '你的')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{t.home.chatHistory}</div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate('/')}
          style={{ marginBottom: 4 }}
        >{t.home.discoverBtn}</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="loading-ring" />
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <div className="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-hint)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{t.home.noHistory}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.home.noHistoryHint}</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>{t.home.goSquare}</button>
        </div>
      ) : (
        <div style={{ padding: '8px 0' }}>
          {history.map(item => (
            <HistoryCard
              key={item.id}
              item={item}
              lang={lang}
              turns={t.home.turns}
              onClick={() => navigate(`/chat/${item.character.id}`)}
              onProfile={() => navigate(`/character/${item.character.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryCard({ item, lang, turns, onClick, onProfile }: {
  item: ChatHistoryItem;
  lang: Lang;
  turns: string;
  onClick: () => void;
  onProfile: () => void;
}) {
  const { character, lastMessage, mood, intimacy, updatedAt, totalTurns } = item;
  const displayName = charField(character.nameEn, character.name);
  const preview = lastMessage
    ? (lastMessage.role === 'user' ? (lang === 'en' ? 'You: ' : '你：') : '') + lastMessage.content.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]/gu, '').slice(0, 40) + (lastMessage.content.length > 40 ? '…' : '')
    : (lang === 'en' ? 'Tap to continue…' : '点击继续聊天');

  const moodClean = mood?.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}]/gu, '').trim() || '';

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
        style={{ position: 'relative', flexShrink: 0, width: 52, height: 52 }}
        onClick={e => { e.stopPropagation(); onProfile(); }}
      >
        {character.portraitUrl ? (
          <img
            src={character.portraitUrl}
            alt={displayName}
            style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <CharInitial name={character.name} size={52} />
        )}
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 9, height: 9, borderRadius: '50%',
          background: '#3dd68c', border: '2px solid var(--bg)',
          boxShadow: '0 0 4px rgba(61,214,140,0.6)',
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', letterSpacing: '0.01em' }}>{displayName}</div>
          <div style={{ fontSize: 10, color: 'var(--text-hint)', flexShrink: 0, marginLeft: 8, letterSpacing: '0.03em' }}>
            {timeAgo(updatedAt, lang)}
          </div>
        </div>
        <div style={{
          fontSize: 13, color: 'var(--text-2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 5,
        }}>{preview}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: intimacyColor(intimacy),
            background: `${intimacyColor(intimacy)}15`,
            border: `1px solid ${intimacyColor(intimacy)}28`,
            borderRadius: 10, padding: '2px 8px',
            letterSpacing: '0.04em',
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: intimacyColor(intimacy), display: 'inline-block' }} />
            <span>{intimacyLabel(intimacy, lang)}</span>
            <span style={{ opacity: 0.5 }}>{intimacy}</span>
          </div>
          {moodClean && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{moodClean}</div>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-hint)', letterSpacing: '0.05em' }}>
            {totalTurns} {turns}
          </div>
        </div>
      </div>

      <div style={{ color: 'var(--text-hint)', fontSize: 16, flexShrink: 0, marginLeft: 4 }}>›</div>
    </div>
  );
}
