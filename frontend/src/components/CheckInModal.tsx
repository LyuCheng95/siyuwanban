import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Props {
  onClose: (gold: number, diamonds: number) => void;
}

const STREAK_DAYS = [
  { day: 1, gold: 100,  diamonds: 0 },
  { day: 2, gold: 150,  diamonds: 0 },
  { day: 3, gold: 200,  diamonds: 0, special: true },
  { day: 4, gold: 140,  diamonds: 0 },
  { day: 5, gold: 160,  diamonds: 0 },
  { day: 6, gold: 180,  diamonds: 0 },
  { day: 7, gold: 500,  diamonds: 1, special: true },
];

export function CheckInModal({ onClose }: Props) {
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.checkin.status().then(setStatus).catch(console.error);
  }, []);

  async function doCheckIn() {
    if (loading || done) return;
    setLoading(true);
    try {
      const res = await api.checkin.perform();
      setResult(res);
      setDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    const gold = result?.gold ?? status?.gold ?? 0;
    const diamonds = result?.diamonds ?? status?.diamonds ?? 0;
    onClose(gold, diamonds);
  }

  const streak = result?.streak ?? status?.streak ?? 0;
  const reward = result?.reward ?? status?.nextReward;
  const alreadyDone = result?.alreadyDone ?? status?.alreadyDone ?? false;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 300, display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    }} onClick={handleClose}>
      <div
        style={{
          width: '100%', background: 'var(--bg-card)',
          borderRadius: '24px 24px 0 0', padding: '24px 20px calc(28px + env(safe-area-inset-bottom))',
          border: '1px solid var(--border)', borderBottom: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'var(--bg-elevated)', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
            {done && !alreadyDone ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            ) : alreadyDone ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>
              </svg>
            ) : (
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(232,53,108,0.2), rgba(154,18,88,0.2))',
                border: '1.5px solid rgba(232,53,108,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {done && !alreadyDone ? '签到成功！' : alreadyDone ? '今日已签到' : '每日签到'}
          </div>
          {streak > 0 && (
            <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>
              连续签到 {streak} 天
            </div>
          )}
        </div>

        {/* 7-day streak calendar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          {STREAK_DAYS.map((d) => {
            const isCurrent = d.day === streak;
            const isPast = d.day < streak;
            const isFuture = d.day > streak;
            const completed = isPast || (done && isCurrent);
            return (
              <div key={d.day} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: completed
                    ? 'var(--gradient)'
                    : isCurrent && !done
                    ? 'var(--gradient-soft)'
                    : 'var(--bg-elevated)',
                  border: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: completed ? 'white' : isFuture ? 'var(--text-hint)' : 'var(--accent)',
                  fontWeight: 700,
                  boxShadow: isCurrent ? '0 0 10px rgba(232,53,108,0.4)' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {d.special && completed
                    ? (d.diamonds > 0
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    )
                    : d.day
                  }
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-hint)' }}>第{d.day}天</div>
              </div>
            );
          })}
        </div>

        {/* Reward display */}
        {reward && (
          <div style={{
            background: 'var(--gradient-soft)',
            border: '1px solid var(--border-accent)',
            borderRadius: 16, padding: '16px', marginBottom: 20,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
              {done && !alreadyDone ? '已获得' : '今日奖励'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-gold)' }}>
                  +{reward.gold}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>金币</div>
              </div>
              {reward.diamonds > 0 && (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#8090f8' }}>
                    +{reward.diamonds}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>钻石</div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, fontWeight: 600 }}>
              {reward.message}
            </div>
          </div>
        )}

        {/* Current balance */}
        {status && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{
              flex: 1, background: 'var(--bg-elevated)', borderRadius: 12,
              padding: '10px', textAlign: 'center', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-gold)' }}>
                {result?.gold ?? status.gold}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>金币</div>
            </div>
            <div style={{
              flex: 1, background: 'var(--bg-elevated)', borderRadius: 12,
              padding: '10px', textAlign: 'center', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#8090f8' }}>
                {result?.diamonds ?? status.diamonds}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>钻石</div>
            </div>
          </div>
        )}

        {/* Button */}
        {!alreadyDone && !done ? (
          <button
            className="btn btn-primary btn-full"
            style={{ fontSize: 16, height: 52 }}
            onClick={doCheckIn}
            disabled={loading}
          >
            {loading ? '领取中...' : '领取今日奖励'}
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-full"
            style={{ fontSize: 15, height: 52 }}
            onClick={handleClose}
          >
            {done && !alreadyDone ? '太棒了，开始聊天' : '明天再来'}
          </button>
        )}
      </div>
    </div>
  );
}
