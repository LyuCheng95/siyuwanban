import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useLang } from '../hooks/useLang';
import type { PaymentTier } from '../types';

interface Props {
  currentDiamonds: number;
  onClose: () => void;
  onSuccess: (newDiamonds: number) => void;
}

type Tab = 'usdt' | 'card';

export function PaywallModal({ currentDiamonds, onClose, onSuccess }: Props) {
  const { t } = useLang();
  const [tiers, setTiers] = useState<PaymentTier[]>([]);
  const [tab, setTab] = useState<Tab>('usdt');
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  // USDT invoice state
  const [invoice, setInvoice] = useState<{
    invoiceId: string; address: string; amount: string; asset: string; network: string; diamonds: number; label: string;
  } | null>(null);
  const [copied, setCopied] = useState<'addr' | 'amt' | null>(null);
  const [usdtStatus, setUsdtStatus] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    api.payments.tiers().then(setTiers).catch(console.error);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // ── Poll balance until diamonds arrive ────────────────────────────────────
  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = true;
    let attempts = 0;
    function poll() {
      if (attempts >= 60) { // ~5 min
        pollingRef.current = false;
        setUsdtStatus(t.paywall.timeout);
        return;
      }
      attempts++;
      api.payments.balance().then(b => {
        if (b.diamonds > currentDiamonds) {
          pollingRef.current = false;
          onSuccess(b.diamonds);
        } else {
          pollRef.current = setTimeout(poll, 5000);
        }
      }).catch(() => { pollRef.current = setTimeout(poll, 5000); });
    }
    poll();
  }

  // ── USDT (TRC-20 direct) ──────────────────────────────────────────────────
  async function buyUsdt(tierIndex: number) {
    setSelectedTier(tierIndex);
    setLoading(true);
    setInvoice(null);
    setUsdtStatus(t.paywall.creating);
    try {
      const inv = await api.payments.cryptoInvoice(tierIndex, 'USDT');
      setInvoice({
        invoiceId: (inv as any).invoiceId ?? '',
        address:   (inv as any).address ?? '',
        amount:    inv.amount,
        asset:     inv.asset,
        network:   (inv as any).network ?? 'TRON',
        diamonds:  inv.diamonds,
        label:     (inv as any).label ?? '',
      });
      setUsdtStatus(null);
      startPolling();
    } catch (e: any) {
      setUsdtStatus('生成失败：' + e.message);
      setLoading(false);
      setSelectedTier(null);
    }
  }

  // ── Card (Stripe) ─────────────────────────────────────────────────────────
  async function buyCard(tierIndex: number) {
    setSelectedTier(tierIndex);
    setLoading(true);
    try {
      const { url } = await api.payments.stripeSession(tierIndex);
      window.open(url, '_blank');
      startPolling();
    } catch {
      setLoading(false);
      setSelectedTier(null);
    }
  }

  function copyText(text: string, which: 'addr' | 'amt') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function resetUsdt() {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollingRef.current = false;
    setInvoice(null);
    setLoading(false);
    setSelectedTier(null);
    setUsdtStatus(null);
  }

  const btnStyle = (i: number): React.CSSProperties => ({
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px',
    background: i === 1 ? 'rgba(232,53,108,0.12)' : 'rgba(255,255,255,0.05)',
    border: i === 1 ? '1px solid rgba(232,53,108,0.4)' : '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, width: '100%', textAlign: 'left',
    cursor: loading ? 'default' : 'pointer',
    opacity: loading && selectedTier !== i ? 0.5 : 1,
    transition: 'all 0.2s',
  });

  const priceTagStyle = (i: number): React.CSSProperties => ({
    background: i === 1 ? 'linear-gradient(135deg, #e8356c, #9a1258)' : 'rgba(255,255,255,0.1)',
    borderRadius: 20, padding: '6px 14px',
    fontSize: 14, fontWeight: 700, color: 'white',
    minWidth: 80, textAlign: 'center', flexShrink: 0,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a0a24, #0f0618)',
        border: '1px solid rgba(255,61,127,0.18)',
        borderRadius: '24px 24px 0 0',
        padding: '28px 20px 36px',
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(245,225,255,0.95)' }}>💎 {t.paywall.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(180,130,210,0.6)', marginTop: 3 }}>
              {t.paywall.balance}：{currentDiamonds} {t.paywall.diamonds}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.06)',
          borderRadius: 12, padding: 4, marginBottom: 20,
        }}>
          {([['usdt', t.paywall.tabUsdt], ['card', t.paywall.tabCard]] as [Tab, string][]).map(([tabKey, label]) => (
            <button key={tabKey} onClick={() => { setTab(tabKey); resetUsdt(); }} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
              background: tab === tabKey ? 'rgba(232,53,108,0.25)' : 'transparent',
              color: tab === tabKey ? '#ff6ba0' : 'rgba(255,255,255,0.4)',
            }}>{label}</button>
          ))}
        </div>

        {/* ── USDT tab ── */}
        {tab === 'usdt' && !invoice && (
          <>
            <div style={{ fontSize: 12, color: 'rgba(180,130,210,0.5)', marginBottom: 12, textAlign: 'center' }}>
              {t.paywall.selectTier}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tiers.map((tier, i) => (
                <button key={tier.id} onClick={() => buyUsdt(i)} disabled={loading} style={btnStyle(i)}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(245,225,255,0.95)' }}>
                      💎 {tier.label}
                    </div>
                    {tier.bonus && <div style={{ fontSize: 12, color: '#e8356c', marginTop: 2 }}>{tier.bonus}</div>}
                  </div>
                  <div style={priceTagStyle(i)}>
                    {selectedTier === i && loading ? t.paywall.processing : `≈$${(tier as any).usdt ?? tier.usd}`}
                  </div>
                </button>
              ))}
            </div>

            {usdtStatus && (
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'rgba(180,130,210,0.7)' }}>
                {usdtStatus}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
              {t.paywall.usdtFee}
            </div>
          </>
        )}

        {/* ── USDT invoice panel ── */}
        {tab === 'usdt' && invoice && (
          <div>
            {/* Amount to send */}
            <div style={{
              background: 'rgba(232,53,108,0.08)',
              border: '1px solid rgba(232,53,108,0.25)',
              borderRadius: 14, padding: '16px 18px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                {t.paywall.exactAmount}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#ff6ba0' }}>
                    {invoice.amount}
                  </span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>
                    USDT (TRC-20)
                  </span>
                </div>
                <button onClick={() => copyText(invoice.amount, 'amt')} style={{
                  background: copied === 'amt' ? 'rgba(80,200,80,0.2)' : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 8, padding: '8px 14px',
                  color: copied === 'amt' ? '#80e080' : 'rgba(255,255,255,0.6)',
                  fontSize: 13, cursor: 'pointer',
                }}>
                  {copied === 'amt' ? t.paywall.copied : t.paywall.copyAmount}
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                {invoice.diamonds} {t.paywall.diamondCount} · {invoice.label}
              </div>
            </div>

            {/* Wallet address */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '14px 16px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                {t.paywall.walletAddress}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(200,200,200,0.8)', wordBreak: 'break-all', lineHeight: 1.6 }}>
                {invoice.address}
              </div>
              <button onClick={() => copyText(invoice.address, 'addr')} style={{
                marginTop: 10, background: copied === 'addr' ? 'rgba(80,200,80,0.2)' : 'rgba(255,255,255,0.08)',
                border: 'none', borderRadius: 8, padding: '8px 16px',
                color: copied === 'addr' ? '#80e080' : 'rgba(255,255,255,0.6)',
                fontSize: 13, cursor: 'pointer', width: '100%',
              }}>
                {copied === 'addr' ? t.paywall.copied : t.paywall.copyAddress}
              </button>
            </div>

            {/* Steps */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px',
              fontSize: 12, color: 'rgba(180,210,180,0.75)', lineHeight: 1.8,
            }}>
              {t.paywall.steps.map((step, i) => (
                <div key={i}>{'①②③④'[i]} {step}</div>
              ))}
            </div>

            {/* Waiting indicator */}
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(180,130,210,0.6)' }}>
              {t.paywall.waiting}
            </div>

            {/* Change tier */}
            <button onClick={resetUsdt} style={{
              marginTop: 12, width: '100%',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '10px 0', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', fontSize: 13,
            }}>
              {t.paywall.changeTier}
            </button>
          </div>
        )}

        {/* ── Card tab ── */}
        {tab === 'card' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tiers.map((tier, i) => (
                <button key={tier.id} onClick={() => buyCard(i)} disabled={loading} style={btnStyle(i)}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(245,225,255,0.95)' }}>
                      💎 {tier.label}
                    </div>
                    {tier.bonus && <div style={{ fontSize: 12, color: '#e8356c', marginTop: 2 }}>{tier.bonus}</div>}
                  </div>
                  <div style={priceTagStyle(i)}>
                    {selectedTier === i && loading ? t.paywall.redirecting : `$${tier.usd}`}
                  </div>
                </button>
              ))}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(180,130,210,0.55)' }}>
                {t.paywall.stripeWaiting}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
              {t.paywall.stripeFee}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
