import { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { PaymentTier } from '../types';

interface Props {
  currentDiamonds: number;
  onClose: () => void;
  onSuccess: (newDiamonds: number) => void;
}

export function PaywallModal({ currentDiamonds, onClose, onSuccess }: Props) {
  const [tiers, setTiers] = useState<PaymentTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  useEffect(() => {
    api.payments.tiers().then(setTiers).catch(console.error);
  }, []);

  // Poll for balance update after redirecting to Stripe
  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    function poll() {
      if (attempts >= 20) return; // stop after ~60s
      attempts++;
      api.payments.balance().then(b => {
        if (b.diamonds > currentDiamonds) {
          onSuccess(b.diamonds);
        } else {
          timer = setTimeout(poll, 3000);
        }
      }).catch(() => { timer = setTimeout(poll, 3000); });
    }

    // Only start polling once a payment has been initiated
    if (loading) poll();
    return () => clearTimeout(timer);
  }, [loading]);

  async function buy(tierIndex: number) {
    setSelectedTier(tierIndex);
    try {
      const { url } = await api.payments.stripeSession(tierIndex);
      setLoading(true);
      window.open(url, '_blank');
    } catch {
      setSelectedTier(null);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 env(safe-area-inset-bottom)',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a0a24, #0f0618)',
        border: '1px solid rgba(255,61,127,0.18)',
        borderRadius: '24px 24px 0 0',
        padding: '28px 20px 32px',
        width: '100%',
        maxWidth: 480,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(245,225,255,0.95)' }}>💎 充值钻石</div>
            <div style={{ fontSize: 13, color: 'rgba(180,130,210,0.6)', marginTop: 3 }}>
              当前余额：{currentDiamonds} 颗钻石
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Tiers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiers.map((tier, i) => (
            <button
              key={tier.id}
              onClick={() => buy(i)}
              disabled={loading}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 18px',
                background: i === 1 ? 'rgba(232,53,108,0.12)' : 'rgba(255,255,255,0.05)',
                border: i === 1 ? '1px solid rgba(232,53,108,0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading && selectedTier !== i ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(245,225,255,0.95)' }}>
                  💎 {tier.label}
                </div>
                {tier.bonus && (
                  <div style={{ fontSize: 12, color: '#e8356c', marginTop: 2 }}>{tier.bonus}</div>
                )}
              </div>
              <div style={{
                background: i === 1 ? 'linear-gradient(135deg, #e8356c, #9a1258)' : 'rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '6px 14px',
                fontSize: 14, fontWeight: 700, color: 'white',
                minWidth: 70, textAlign: 'center',
              }}>
                {selectedTier === i && loading ? '跳转中…' : `$${tier.usd}`}
              </div>
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(180,130,210,0.55)' }}>
            支付完成后钻石将自动到账，请稍候…
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          通过 Stripe 安全支付 · 不自动续费
        </div>
      </div>
    </div>
  );
}
