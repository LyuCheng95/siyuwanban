import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLang, toggleLang } from '../hooks/useLang';
import { setLang } from '../i18n';
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
  const { t, lang } = useLang();
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  useEffect(() => {
    api.characters.mine().then(setMyChars).catch(console.error);
  }, []);

  async function deleteChar(id: string) {
    if (!window.confirm(lang === 'en' ? 'Delete this character? All conversation history will also be removed.' : '确定删除这个角色吗？所有对话记录也会删除。')) return;
    setDeletingId(id);
    await api.characters.delete(id).catch(console.error);
    setMyChars(prev => prev.filter(c => c.id !== id));
    setDeletingId(null);
  }

  async function handleRedeem() {
    if (!redeemCode.trim()) return;
    setRedeemLoading(true);
    setRedeemStatus(null);
    try {
      const res = await api.redeem.use(redeemCode.trim());
      setUser({ ...user, paidCredits: res.newBalance });
      setRedeemStatus({ ok: true, msg: `✅ 成功兑换 ${res.diamondsGranted} 钻石！` });
      setRedeemCode('');
    } catch (e: any) {
      setRedeemStatus({ ok: false, msg: e.message || '兑换失败' });
    } finally {
      setRedeemLoading(false);
    }
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
                placeholder={lang === 'en' ? 'Enter nickname (max 20 chars)' : '输入昵称（最多20字）'}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 8, padding: '5px 10px', color: 'var(--text-1)', fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={saveName} disabled={savingName} style={{
                background: 'var(--gradient)', border: 'none', borderRadius: 8,
                color: 'white', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
              }}>{t.common.save}</button>
              <button onClick={() => setEditingName(false)} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8,
                color: 'var(--text-2)', fontSize: 13, padding: '5px 10px', cursor: 'pointer',
              }}>{t.common.cancel}</button>
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
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t.me.diamondHint}</div>
          </div>
          {/* Coins — secondary, check-in only */}
          <div style={{
            flex: 1, background: 'rgba(196,144,56,0.08)', border: '1px solid rgba(196,144,56,0.18)',
            borderRadius: 12, padding: '14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: '-0.02em' }}>{user.freeCredits}</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t.me.gold}</div>
            <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 1 }}>{t.me.goldHint}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={() => setShowPayment(true)}>
          {t.me.topup}
        </button>
        {user.freeCredits >= 10 && (
          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 8 }}
            onClick={async () => {
              if (!window.confirm(lang === 'en'
                ? 'Exchange 10 coins → 1 diamond?'
                : '确认用 10 金币兑换 1 钻石？')) return;
              try {
                const res = await api.payments.exchangeCoins(10);
                setUser({ ...user, freeCredits: res.newCoins, paidCredits: res.newDiamonds });
              } catch {}
            }}
          >
            {t.me.exchangeCoins}
          </button>
        )}

        {/* Language toggle */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 2px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>🌐 {t.me.language}</div>
          <button
            onClick={() => setLang(toggleLang(lang))}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '5px 14px', cursor: 'pointer',
              color: 'var(--text)', fontSize: 13, fontWeight: 600,
            }}
          >
            {lang === 'zh' ? 'English' : '中文'}
          </button>
        </div>

        {/* Redeem code */}
        <div style={{ marginTop: 12, padding: '14px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 8 }}>🎁 {t.me.redeem}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={redeemCode}
              onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemStatus(null); }}
              placeholder="XXXX-XXXX-XXXX"
              maxLength={14}
              style={{
                flex: 1, padding: '9px 12px', background: 'var(--bg)', border: '1.5px solid var(--border)',
                borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none',
                fontFamily: 'monospace', letterSpacing: '0.05em',
              }}
              onKeyDown={e => e.key === 'Enter' && !redeemLoading && handleRedeem()}
            />
            <button
              className="btn btn-primary"
              style={{ padding: '9px 16px', fontSize: 13, flexShrink: 0 }}
              disabled={redeemLoading || !redeemCode.trim()}
              onClick={handleRedeem}
            >
              {redeemLoading ? '…' : t.me.redeemBtn}
            </button>
          </div>
          {redeemStatus && (
            <div style={{ marginTop: 8, fontSize: 12, color: redeemStatus.ok ? 'var(--accent-green, #4ade80)' : '#f87171' }}>
              {redeemStatus.msg}
            </div>
          )}
        </div>
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
        {t.me.myChars}
      </div>
      {myChars.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <div className="empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-hint)' }}>
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              <line x1="12" y1="14" x2="12" y2="14"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{t.me.noChars}</div>
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
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{char.occupation} · {char.usageCount} {t.me.chatCount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 1, letterSpacing: '0.04em' }}>
                {char.isPublic ? t.me.public : t.me.private}
                {char.reviewCount > 0 && ` · ${char.avgRating.toFixed(1)} ${t.profile.ratingLabel}`}
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
