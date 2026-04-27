import { useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../api/client';
import type { User } from '../types';

// 生成或读取设备唯一 ID
function getDeviceId(): string {
  const KEY = 'sywb_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    // 生成随机 ID，结合时间戳和随机数
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10) +
         Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const deviceId = getDeviceId();
        const { token, user } = await api.auth.anonymous(deviceId);
        setToken(token);
        setUser(user);
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
