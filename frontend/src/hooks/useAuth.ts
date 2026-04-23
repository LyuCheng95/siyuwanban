import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { api, setToken, clearToken } from '../api/client';
import type { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        WebApp.ready();
        const initData = WebApp.initData;

        if (!initData) {
          // Dev fallback: mock initData
          setError('请在 Telegram 中打开此应用');
          setLoading(false);
          return;
        }

        const { token, user } = await api.auth.telegram(initData);
        setToken(token);
        setUser(user);
      } catch (err) {
        clearToken();
        setError('登录失败，请重试');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function updateCredits(free: number, paid: number) {
    setUser(prev => prev ? { ...prev, freeCredits: free, paidCredits: paid } : null);
  }

  return { user, loading, error, updateCredits, setUser };
}
