import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { api } from '../api/client';
import type { Character, PaymentTier, User } from '../types';

interface Props {
  user: User;
  setUser: (u: User | null) => void;
}

export function ProfilePage({ user, setUser }: Props) {
  const navigate = useNavigate();
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [tiers, setTiers] = useState<PaymentTier[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.characters.mine().then(setMyChars).catch(console.error);
    api.payments.tiers().then(setTiers).catch(console.error);
  }, []);

  async function buyTier(i: number) {
    try {
      const { invoiceLink, tier } = await api.payments.createInvoice(i);
      WebApp.openInvoice(invoiceLink, (status) => {
        if (status === 'paid') {
          setUser({ ...user, paidCredits: user.paidCredits + tier.turns });
          WebApp.showAlert(`购买成功！已获得 ${tier.turns} 次对话次数 🎉`);
          setShowPayment(false);
        }
      });
    } catch {
      WebApp.showAlert('创建订单失败，请稍后重试');
    }
  }

  async function deleteChar(id: string) {
    WebApp.showConfirm('确定删除这个角色吗？所有对话记录也会删除。', async (confirmed) => {
      if (!confirmed) return;
      setDeletingId(id);
      await api.characters.delete(id).catch(console.error);
      setMyChars(prev => prev.filter(c => c.id !== id));
      setDeletingId(null);
    });
  }

  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user.username || '用户';

  return (
    <div className="page" style={{ paddingTop: 16 }}>
      {/* User info */}
      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 22, fontWeight: 700, flexShrink: 0,
        }}>
          {user.photoUrl
            ? <img src={user.photoUrl} style={{ width: 56, height: 56, borderRadius: '50%' }} />
            : displayName[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}</div>
          {user.username && <div style={{ color: 'var(--text-hint)', fontSize: 13 }}>@{user.username}</div>}
        </div>
      </div>

      {/* Credits card */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #7c3aed22, #a855f722)', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>剩余对话次数</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
              {user.freeCredits + user.paidCredits}
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-hint)', marginLeft: 4 }}>次</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>
              💚 免费 {user.freeCredits} · ⭐ 已购 {user.paidCredits}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowPayment(true)}>
            购买次数
          </button>
        </div>
      </div>

      {/* Payment sheet */}
      {showPayment && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 100, display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setShowPayment(false)}>
          <div
            style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              购买对话次数
            </div>
            <div style={{ textAlign: 'center', color: 'var(--text-hint)', fontSize: 13, marginBottom: 20 }}>
              使用 Telegram Stars ⭐ 支付
            </div>
            {tiers.map((tier, i) => (
              <button
                key={i}
                className="btn btn-secondary btn-full"
                style={{ marginBottom: 10, justifyContent: 'space-between', padding: '14px 18px' }}
                onClick={() => buyTier(i)}
              >
                <span style={{ fontWeight: 600 }}>🗨️ {tier.turns}次对话</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>⭐ {tier.stars}</span>
              </button>
            ))}
            <button className="btn btn-secondary btn-full" style={{ marginTop: 4 }} onClick={() => setShowPayment(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* My characters */}
      <div className="section-title">我创建的角色</div>
      {myChars.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <div className="emoji">✨</div>
          <div>还没有创建角色</div>
          <button className="btn btn-primary" onClick={() => navigate('/wizard')}>创建第一个</button>
        </div>
      ) : (
        myChars.map(char => (
          <div key={char.id} className="character-card">
            <div className="character-avatar" onClick={() => navigate(`/chat/${char.id}`)}>
              {char.avatarEmoji}
            </div>
            <div className="character-info" onClick={() => navigate(`/chat/${char.id}`)}>
              <div className="character-name">{char.name}</div>
              <div className="character-meta">{char.occupation} · 被使用 {char.usageCount} 次</div>
              <div className="character-meta">
                {char.isPublic ? '🌍 公开' : '🔒 私密'}
                {char.reviewCount > 0 && ` · ⭐ ${char.avgRating.toFixed(1)}`}
              </div>
            </div>
            <button
              style={{
                background: 'none', border: 'none', color: '#ef4444',
                fontSize: 20, cursor: 'pointer', padding: '4px 8px',
                opacity: deletingId === char.id ? 0.4 : 1,
              }}
              onClick={() => deleteChar(char.id)}
              disabled={deletingId === char.id}
            >
              🗑
            </button>
          </div>
        ))
      )}
    </div>
  );
}
