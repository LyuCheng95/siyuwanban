import { useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../api/client';
import { getLang } from '../i18n';
import type { User } from '../types';

function getDeviceId(): string {
  const KEY = 'sywb_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10) +
         Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getTelegramInitData(): string | null {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initData && tg.initData.length > 0) {
      tg.ready();
      tg.expand();
      return tg.initData;
    }
  } catch {}
  return null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const initData = getTelegramInitData();

        if (initData) {
          // Telegram 环境：自动登录
          const result = await api.auth.telegram(initData);
          setToken(result.token);
          setUser(result.user);
          const localLang = getLang();
          if (localLang !== result.user.language) {
            api.auth.setLanguage(localLang).catch(() => {});
          }
          return;
        }

        // 普通浏览器：检查本地是否已有 token（邮箱登录过 / 游客模式）
        const savedToken = localStorage.getItem('soul_link_token');
        if (savedToken) {
          try {
            setToken(savedToken);
            const result = await api.auth.anonymous(getDeviceId());
            setToken(result.token);
            setUser(result.user);
            return;
          } catch {
            clearToken();
          }
        }

        // 无 token + 非 Telegram：显示登录/注册页
        setNeedsAuth(true);
      } catch {
        clearToken();
        setError('连接失败，请检查网络后刷新重试');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function handleAuthSuccess(token: string, userData: User) {
    setToken(token);
    setUser(userData);
    setNeedsAuth(false);
  }

  async function continueAsGuest() {
    setLoading(true);
    try {
      const result = await api.auth.anonymous(getDeviceId());
      setToken(result.token);
      setUser(result.user);
      setNeedsAuth(false);
    } catch {
      setError('连接失败，请检查网络后刷新重试');
    } finally {
      setLoading(false);
    }
  }

  function updateCredits(free: number, paid: number) {
    setUser(prev => prev ? { ...prev, freeCredits: free, paidCredits: paid } : null);
  }

  return { user, loading, error, needsAuth, handleAuthSuccess, continueAsGuest, updateCredits, setUser };
}
