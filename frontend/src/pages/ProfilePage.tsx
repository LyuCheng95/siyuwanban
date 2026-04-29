import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Character, User } from '../types';
import { PaywallModal } from '../components/PaywallModal';

interface Props {
  user: User;
  setUser: (u: User | null) => void;
}

function CharInitial({ name, size = 52 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #2a0840, #6a1060)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
    }}>
      {name.slice(0, 1)}
    </div>
  );
}

export function ProfilePage({ user, setUser }: Props) {
  const navigate = useNavigate();
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    api.characters.mine().then(setMyChars).catch(console.error);
  }, []);

  async function deleteChar(id: string) {
    if (!window.confirm('确定删除这个角色吗？所有对话记录也会删除。')) return;
    setDeletingId(id);
    await api.characters.delete(id).catch(console.error);
    setMyChars(prev => prev.filter(c => c.id !== id));
    setDeletingId(null);
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setSavingName(true);
    try {
      await api.auth.setNickname(nameInput.trim());
      setUser({ ...user, nickname: nameInput.trim() });
      setEditingName(false);
    } catch {}
    setSavingName(false);
  }

  const displayName = user.nickname
    ? user.nickname
    : user.firstName && user.firstName !== '匿名用户'
      ? `${user.firstName}${(user as any).lastName ? ' ' + (user as any).lastName : ''}`
      : user.username?.startsWith('anon_') ? '神秘访客' : user.username || '神秘访客';

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      {/* User info */}
      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14, margin: '0 12px 14px' }}>
        <div style={{ flexShrink: 0 }}>
          {user.photoUrl ? (
            <img src={user.photoUrl} style={{ width: 52, height: 52, borderRadius: '50%', display: 'block' }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 20, fontWeight: 700,
            }}>
              {displayName[0].toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                maxLength={20}
                placeholder="输入昵称（最多20字）"
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 8, padding: '5px 10px', color: 'var(--text-1)', fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={saveName} disabled={savingName} style={{
                background: 'var(--gradient)', border: 'none', borderRadius: 8,
                color: 'white', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
              }}>保存</button>
              <button onClick={() => setEditingName(false)} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8,
                color: 'var(--text-2)', fontSize: 13, padding: '5px 10px', cursor: 'pointer',
              }}>取消</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{displayName}</div>
              <button onClick={() => { setNameInput(user.nickname || ''); setEditingName(true); }} style={{
                background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer',
                color: 'var(--text-hint)', fontSize: 12, lineHeight: 1,
              }}>✎</button>
            </div>
          )}
          {user.username && <div style={{ color: 'var(--text-hint)', fontSize: 12, marginTop: 2, letterSpacing: '0.03em' }}>@{user.username}</div>}
        </div>
      </div>

      {/* Currency card */}
      <div className="card" style={{ margin: '0 12px 14px', background: 'rgba(154,18,88,0.06)', border: '1px solid rgba(154,18,88,0.12)' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {/* Diamonds — primary paid currency */}
          <div style={{
            flex: 2, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 12, padding: '14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#8090f8', letterSpacing: '-0.02em' }}>💎 {user.paidCredits}</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>钻石 · 聊天消耗</div>
          </div>
          {/* Coins — secondary, check-in only */}
          <div style={{
            flex: 1, background: 'rgba(196,144,56,0.08)', border: '1px solid rgba(196,144,56,0.18)',
            borderRadius: 12, padding: '14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: '-0.02em' }}>{user.freeCredits}</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>金币</div>
            <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 1 }}>签到获取</div>
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={() => setShowPayment(true)}>
          充值钻石
        </button>
        {user.freeCredits >= 10 && (
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 8 }}
            onClick={async () => {
              try {
                const res = await api.payments.exchangeCoins(10);
                setUser({ ...user, freeCredits: res.newCoins, paidCredits: res.newDiamonds });
              } catch {}
            }}
          >
            兑换 10 金币 → 1 钻石
          </button>
        )}
      </div>

      {showPayment && (
        <PaywallModal
          currentDiamonds={user.paidCredits}
          onClose={() => setShowPayment(false)}
          onSuccess={newDiamonds => {
            setUser({ ...user, paidCredits: newDiamonds });
            setShowPayment(false);
          }}
        />
      )}

      {/* My characters */}
      <div style={{ padding: '16px 14px 6px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        我创建的角色
      </div>
      {myChars.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <div className="empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-hint)' }}>
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              <line x1="12" y1="14" x2="12" y2="14"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>还没有创建角色</div>
        </div>
      ) : (
        myChars.map(char => (
          <div key={char.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ flexShrink: 0, cursor: 'pointer' }} onClick={() => navigate(`/chat/${char.id}`)}>
              {char.portraitUrl ? (
                <img src={char.portraitUrl} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
              ) : (
                <CharInitial name={char.name} size={44} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/chat/${char.id}`)}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{char.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{char.occupation} · {char.usageCount} 次对话</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1, letterSpacing: '0.04em' }}>
                {char.isPublic ? '公开' : '私密'}
                {char.reviewCount > 0 && ` · ${char.avgRating.toFixed(1)} 分`}
              </div>
            </div>
            <button
              style={{
                background: 'none', border: '1px solid rgba(239,68,68,0.2)',
                color: 'rgba(239,68,68,0.6)', borderRadius: 8,
                width: 32, height: 32, cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                opacity: deletingId === char.id ? 0.4 : 1,
              }}
              onClick={() => deleteChar(char.id)}
              disabled={deletingId === char.id}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          </div>
        ))
      )}
    </div>
  );
}
