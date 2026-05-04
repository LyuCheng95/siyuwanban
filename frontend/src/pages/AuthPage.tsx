import { useState } from 'react';
import { api } from '../api/client';
import type { User } from '../types';

interface Props {
  onSuccess: (token: string, user: User) => void;
  onGuest: () => void;
}

export function AuthPage({ onSuccess, onGuest }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = tab === 'login'
        ? await api.auth.login(email.trim(), password)
        : await api.auth.register(email.trim(), password);
      onSuccess(result.token, result.user);
    } catch (err: any) {
      setError(err?.data?.message || (tab === 'login' ? '邮箱或密码错误' : '注册失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#09090f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e8356c, #9a1258)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(232,53,108,0.35)',
          margin: '0 auto 16px',
        }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div style={{
          fontSize: 13, letterSpacing: 6, fontWeight: 400,
          background: 'linear-gradient(135deg,#e8356c,#9a1258)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>私欲玩伴</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>AI 情感陪伴</div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-card)', borderRadius: 20,
        border: '1px solid var(--border)', padding: '28px 24px',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 12, padding: 4 }}>
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 9, border: 'none',
                background: tab === t ? 'var(--gradient)' : 'transparent',
                color: tab === t ? 'white' : 'var(--text-2)',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {t === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>邮箱</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>密码{tab === 'register' ? '（至少6位）' : ''}</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={tab === 'register' ? '请设置密码' : '请输入密码'}
              required
              minLength={tab === 'register' ? 6 : 1}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 15, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(232,53,108,0.1)', border: '1px solid rgba(232,53,108,0.3)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: '#e8356c',
            }}>
              {error}
            </div>
          )}

          {tab === 'register' && (
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 16, lineHeight: 1.6 }}>
              注册即表示你已满18岁，同意平台服务条款和隐私政策。
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-full"
            style={{ fontSize: 16, height: 50 }}
          >
            {loading ? '处理中...' : (tab === 'login' ? '登录' : '注册账号')}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>或</div>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Guest */}
        <button
          onClick={onGuest}
          className="btn btn-secondary btn-full"
          style={{ fontSize: 14, height: 46 }}
        >
          游客体验（不保存进度）
        </button>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-hint)', textAlign: 'center' }}>
        本平台内容仅限成人访问
      </div>
    </div>
  );
}
