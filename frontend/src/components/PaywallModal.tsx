import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useLang } from '../hooks/useLang';
import type { PaymentTier } from '../types';

interface Props {
  currentDiamonds: number;
  onClose: () => void;
  onSuccess: (newDiamonds: number) => void;
}

type Tab = 'usdt' | 'card' | 'stars';

export function PaywallModal({ currentDiamonds, onClose, onSuccess }: Props) {
  const { t } = useLang();
  const [tiers, setTiers] = useState<PaymentTier[]>([]);
  const [tab, setTab] = useState<Tab>('usdt');
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);

  // USDT invoice state
  const [invoice, setInvoice] = useState<{
    invoiceId: string; address: string; amount: string; asset: string; network: string; diamonds: number; label: string;
  } | null>(null);
  const [copied, setCopied] = useState<'addr' | 'amt' | null>(null);
  const [usdtStatus, setUsdtStatus] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    // Load tiers + check first-purchase status in parallel
    api.payments.tiers().then(setTiers).catch(console.error);
    api.payments.balance().then(b => {
      if (b.isFirstPurchase) setIsFirstPurchase(true);
    }).catch(console.error);

    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  // ── Poll balance until diamonds arrive ────────────────────────────────────
  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = true;
    let attempts = 0;
    function poll() {
      if (attempts >= 60) {
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

  // ── Telegram Stars ────────────────────────────────────────────────────────
  async function buyStars(tierIndex: number) {
    setSelectedTier(tierIndex);
    setLoading(true);
    setUsdtStatus(t.paywall.starsOpening);
    try {
      const { invoiceLink } = await api.payments.starsInvoice(tierIndex);
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp?.openInvoice) {
        tgWebApp.openInvoice(invoiceLink, (status: string) => {
          if (status === 'paid') {
            startPolling();
          } else {
            setLoading(false);
            setSelectedTier(null);
            setUsdtStatus(status === 'cancelled' ? null : `支付状态：${status}`);
          }
        });
      } else {
        // Fallback: open in browser (won't get callback, poll anyway)
        window.open(invoiceLink, '_blank');
        startPolling();
      }
      setUsdtStatus(null);
    } catch (e: any) {
      setUsdtStatus('创建失败：' + e.message);
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

  function renderStarsTierButton(tier: PaymentTier) {
    const isPopular = tier.id === 1;
    const isMonthly = !!tier.monthly;
    const isBest = tier.id === 3;

    const borderColor = isMonthly
      ? 'rgba(255,200,50,0.45)'
      : isPopular
        ? 'rgba(232,53,108,0.4)'
        : isBest
          ? 'rgba(120,80,255,0.4)'
          : 'rgba(255,255,255,0.1)';

    const bg = isMonthly
      ? 'rgba(255,200,50,0.1)'
      : isPopular
        ? 'rgba(232,53,108,0.12)'
        : isBest
          ? 'rgba(120,80,255,0.1)'
          : 'rgba(255,255,255,0.05)';

    const effectiveDiamonds = isFirstPurchase ? tier.diamonds * 2 : tier.diamonds;
    const stars = tier.stars ?? 0;

    return (
      <button
        key={tier.id}
        onClick={() => buyStars(tier.id)}
        disabled={loading}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px',
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: 14, width: '100%', textAlign: 'left',
          cursor: loading ? 'default' : 'pointer',
          opacity: loading && selectedTier !== tier.id ? 0.5 : 1,
          transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        {isMonthly && (
          <div style={{
            position: 'absolute', top: -1, right: -1,
            background: 'linear-gradient(135deg, #f5c842, #e8a020)',
            borderRadius: '0 13px 0 10px',
            padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1a0a24',
          }}>
            {t.paywall.monthlyBadge}
          </div>
        )}
        {isPopular && !isMonthly && (
          <div style={{
            position: 'absolute', top: -1, right: -1,
            background: 'linear-gradient(135deg, #e8356c, #9a1258)',
            borderRadius: '0 13px 0 10px',
            padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'white',
          }}>🔥</div>
        )}
        {isBest && !isMonthly && (
          <div style={{
            position: 'absolute', top: -1, right: -1,
            background: 'linear-gradient(135deg, #7850ff, #4020c0)',
            borderRadius: '0 13px 0 10px',
            padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'white',
          }}>💎</div>
        )}

        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(245,225,255,0.95)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💎 {effectiveDiamonds}</span>
            {isFirstPurchase && (
              <span style={{ fontSize: 11, color: '#f5c842', background: 'rgba(245,200,50,0.15)', borderRadius: 6, padding: '1px 6px' }}>
                ×2
              </span>
            )}
          </div>
          {isMonthly
            ? <div style={{ fontSize: 12, color: 'rgba(245,200,80,0.7)', marginTop: 2 }}>{t.paywall.monthlyHint}</div>
            : null}
        </div>
        <div style={{
          background: isMonthly
            ? 'linear-gradient(135deg, #f5c842, #c88010)'
            : isPopular
              ? 'linear-gradient(135deg, #e8356c, #9a1258)'
              : isBest
                ? 'linear-gradient(135deg, #7850ff, #4020c0)'
                : 'rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '6px 14px',
          fontSize: 14, fontWeight: 700,
          color: isMonthly ? '#1a0a24' : 'white',
          minWidth: 80, textAlign: 'center', flexShrink: 0,
        }}>
          {selectedTier === tier.id && loading ? t.paywall.starsOpening : `⭐ ${stars}`}
        </div>
      </button>
    );
  }

  // Split tiers: monthly card first, then regular sorted by diamonds
  const monthlyTier = tiers.find(t => t.monthly);
  const regularTiers = tiers.filter(t => !t.monthly);

  function renderTierButton(tier: PaymentTier, i: number, onBuy: (idx: number) => void, priceKey: 'usd' | 'usdt', loadingLabel: string) {
    const isPopular = tier.id === 1;
    const isMonthly = !!tier.monthly;
    const isBest = tier.id === 3;

    const borderColor = isMonthly
      ? 'rgba(255,200,50,0.45)'
      : isPopular
        ? 'rgba(232,53,108,0.4)'
        : isBest
          ? 'rgba(120,80,255,0.4)'
          : 'rgba(255,255,255,0.1)';

    const bg = isMonthly
      ? 'rgba(255,200,50,0.1)'
      : isPopular
        ? 'rgba(232,53,108,0.12)'
        : isBest
          ? 'rgba(120,80,255,0.1)'
          : 'rgba(255,255,255,0.05)';

    const price = priceKey === 'usdt'
      ? ((tier as any).usdt ?? tier.usd)
      : tier.usd;

    // Show 2× for first purchase
    const effectiveDiamonds = isFirstPurchase ? tier.diamonds * 2 : tier.diamonds;

    return (
      <button
        key={tier.id}
        onClick={() => onBuy(tier.id)}
        disabled={loading}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px',
          background: bg,
          border: `1px solid ${borderColor}`,
          borderRadius: 14, width: '100%', textAlign: 'left',
          cursor: loading ? 'default' : 'pointer',
          opacity: loading && selectedTier !== tier.id ? 0.5 : 1,
          transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        {/* Monthly badge */}
        {isMonthly && (
          <div style={{
            position: 'absolute', top: -1, right: -1,
            background: 'linear-gradient(135deg, #f5c842, #e8a020)',
            borderRadius: '0 13px 0 10px',
            padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1a0a24',
          }}>
            {t.paywall.monthlyBadge}
          </div>
        )}

        {/* Popular badge */}
        {isPopular && !isMonthly && (
          <div style={{
            position: 'absolute', top: -1, right: -1,
            background: 'linear-gradient(135deg, #e8356c, #9a1258)',
            borderRadius: '0 13px 0 10px',
            padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'white',
          }}>
            🔥
          </div>
        )}

        {/* Best value badge */}
        {isBest && !isMonthly && (
          <div style={{
            position: 'absolute', top: -1, right: -1,
            background: 'linear-gradient(135deg, #7850ff, #4020c0)',
            borderRadius: '0 13px 0 10px',
            padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'white',
          }}>
            💎
          </div>
        )}

        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(245,225,255,0.95)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💎 {effectiveDiamonds}</span>
            {isFirstPurchase && (
              <span style={{ fontSize: 11, color: '#f5c842', background: 'rgba(245,200,50,0.15)', borderRadius: 6, padding: '1px 6px' }}>
                ×2
              </span>
            )}
          </div>
          {isMonthly
            ? <div style={{ fontSize: 12, color: 'rgba(245,200,80,0.7)', marginTop: 2 }}>{t.paywall.monthlyHint}</div>
            : tier.bonus && !isPopular && !isBest
              ? <div style={{ fontSize: 12, color: 'rgba(180,130,210,0.6)', marginTop: 2 }}>{tier.bonus}</div>
              : null}
        </div>
        <div style={{
          background: isMonthly
            ? 'linear-gradient(135deg, #f5c842, #c88010)'
            : isPopular
              ? 'linear-gradient(135deg, #e8356c, #9a1258)'
              : isBest
                ? 'linear-gradient(135deg, #7850ff, #4020c0)'
                : 'rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '6px 14px',
          fontSize: 14, fontWeight: 700,
          color: (isMonthly) ? '#1a0a24' : 'white',
          minWidth: 70, textAlign: 'center', flexShrink: 0,
        }}>
          {selectedTier === tier.id && loading ? loadingLabel : `$${price}`}
        </div>
      </button>
    );
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
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

        {/* First-purchase banner */}
        {isFirstPurchase && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245,200,50,0.15), rgba(232,100,20,0.15))',
            border: '1px solid rgba(245,200,50,0.4)',
            borderRadius: 12, padding: '10px 16px',
            fontSize: 13, fontWeight: 600,
            color: '#f5c842', marginBottom: 16,
            textAlign: 'center',
          }}>
            {t.paywall.firstPurchaseBanner}
          </div>
        )}

        {/* Tab switcher */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.06)',
          borderRadius: 12, padding: 4, marginBottom: 20,
        }}>
          {([['usdt', t.paywall.tabUsdt], ['card', t.paywall.tabCard], ['stars', t.paywall.tabStars]] as [Tab, string][]).map(([tabKey, label]) => (
            <button key={tabKey} onClick={() => { setTab(tabKey); resetUsdt(); }} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
              background: tab === tabKey ? 'rgba(232,53,108,0.25)' : 'transparent',
              color: tab === tabKey ? '#ff6ba0' : 'rgba(255,255,255,0.4)',
            }}>{label}</button>
          ))}
        </div>

        {/* ── USDT tab — tier selection ── */}
        {tab === 'usdt' && !invoice && (
          <>
            <div style={{ fontSize: 12, color: 'rgba(180,130,210,0.5)', marginBottom: 10, textAlign: 'center' }}>
              {t.paywall.selectTier}
            </div>

            {/* Monthly card (featured) */}
            {monthlyTier && (
              <div style={{ marginBottom: 10 }}>
                {renderTierButton(monthlyTier, -1, buyUsdt, 'usdt', t.paywall.processing)}
              </div>
            )}

            {/* Divider */}
            {monthlyTier && regularTiers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{t.paywall.tierPacks}</div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            )}

            {/* Regular tiers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {regularTiers.map((tier, i) => renderTierButton(tier, i, buyUsdt, 'usdt', t.paywall.processing))}
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
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#ff6ba0' }}>{invoice.amount}</span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>USDT (TRC-20)</span>
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

            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px',
              fontSize: 12, color: 'rgba(180,210,180,0.75)', lineHeight: 1.8,
            }}>
              {t.paywall.steps.map((step, i) => (
                <div key={i}>{'①②③④'[i]} {step}</div>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(180,130,210,0.6)' }}>
              {t.paywall.waiting}
            </div>

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

        {/* ── Stars tab ── */}
        {tab === 'stars' && (
          <>
            {/* Monthly card (featured) */}
            {monthlyTier && (
              <div style={{ marginBottom: 10 }}>
                {renderStarsTierButton(monthlyTier)}
              </div>
            )}

            {monthlyTier && regularTiers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{t.paywall.tierPacks}</div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {regularTiers.map(tier => renderStarsTierButton(tier))}
            </div>

            {usdtStatus && (
              <div style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'rgba(180,130,210,0.7)' }}>
                {usdtStatus}
              </div>
            )}
            {loading && !usdtStatus && (
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(180,130,210,0.55)' }}>
                {t.paywall.starsWaiting}
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
              {t.paywall.starsHint}
            </div>
          </>
        )}

        {/* ── Card tab ── */}
        {tab === 'card' && (
          <>
            {/* Monthly card (featured) */}
            {monthlyTier && (
              <div style={{ marginBottom: 10 }}>
                {renderTierButton(monthlyTier, -1, buyCard, 'usd', t.paywall.redirecting)}
              </div>
            )}

            {monthlyTier && regularTiers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{t.paywall.tierPacks}</div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {regularTiers.map((tier, i) => renderTierButton(tier, i, buyCard, 'usd', t.paywall.redirecting))}
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
