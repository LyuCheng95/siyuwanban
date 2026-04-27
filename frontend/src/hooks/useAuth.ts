import { useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../api/client';
import type { User } from '../types';

// 生成或读取设备唯一 ID（匿名登录用）
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

// 判断是否在 Telegram 环境中
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

  useEffect(() => {
    async function init() {
      try {
        const initData = getTelegramInitData();
        let result: { token: string; user: User };

        if (initData) {
          // Telegram 环境：用 Telegram 账号登录
          result = await api.auth.telegram(initData);
        } else {
          // 普通浏览器：匿名登录
          result = await api.auth.anonymous(getDeviceId());
        }

        setToken(result.token);
        setUser(result.user);
      } catch (err) {
        clearToken();
        setError('登录失败，请刷新重试');
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
