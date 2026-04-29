const BASE = import.meta.env.VITE_API_URL || '/api';

let authToken: string | null = localStorage.getItem('soul_link_token');

export function setToken(token: string) {
  authToken = token;
  localStorage.setItem('soul_link_token', token);
}

export function clearToken() {
  authToken = null;
  localStorage.removeItem('soul_link_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err });
  }
  return res.json();
}

// Auth
export const api = {
  auth: {
    anonymous: (deviceId: string) =>
      request<{ token: string; user: import('../types').User }>('/auth/anonymous', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      }),
    telegram: (initData: string) =>
      request<{ token: string; user: import('../types').User }>('/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      }),
    setNickname: (nickname: string) =>
      request<{ ok: boolean; nickname: string }>('/auth/nickname', {
        method: 'PATCH',
        body: JSON.stringify({ nickname }),
      }),
  },

  characters: {
    mine: () => request<import('../types').Character[]>('/characters/mine'),
    get: (id: string) => request<import('../types').Character>(`/characters/${id}`),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/characters/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list: () => request<import('../types').ChatHistoryItem[]>('/chat'),
  },

  chat: {
    get: (characterId: string) =>
      request<{
        conversation: import('../types').Conversation | null;
        character: import('../types').Character;
        credits: { free: number; paid: number };
      }>(`/chat/${characterId}`),

    // Returns an EventSource-compatible fetch stream
    send: (characterId: string, message: string) =>
      fetch(`${BASE}/chat/${characterId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ message }),
      }),

    saveImage: (characterId: string, imageUrl: string) =>
      request<{ ok: boolean }>(`/chat/${characterId}/save-image`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl }),
      }),
  },

  marketplace: {
    list: (params?: { sort?: string; page?: number; search?: string }) => {
      // Filter out undefined/null values before building query string
      const clean = Object.fromEntries(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      const q = new URLSearchParams(clean as Record<string, string>).toString();
      return request<{
        characters: import('../types').Character[];
        total: number;
        page: number;
      }>(`/marketplace${q ? `?${q}` : ''}`);
    },
    leaderboard: () =>
      request<{ byUsage: import('../types').Character[]; byRating: import('../types').Character[] }>(
        '/marketplace/leaderboard'
      ),
    review: (characterId: string, data: { rating: number; comment?: string }) =>
      request<{ ok: boolean }>(`/marketplace/${characterId}/review`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  payments: {
    tiers: () => request<import('../types').PaymentTier[]>('/payments/tiers'),
    balance: () => request<{ diamonds: number; coins: number }>('/payments/balance'),
    stripeSession: (tierIndex: number) =>
      request<{ url: string; sessionId: string }>(
        '/payments/stripe/create-session',
        { method: 'POST', body: JSON.stringify({ tierIndex }) }
      ),
    exchangeCoins: (amount: number) =>
      request<{ ok: boolean; coinsSpent: number; diamondsReceived: number; newCoins: number; newDiamonds: number }>(
        '/payments/exchange-coins',
        { method: 'POST', body: JSON.stringify({ amount }) }
      ),
  },

  images: {
    generate: (prompt: string, characterName?: string) =>
      request<{ url: string }>('/images/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, characterName }),
      }),
  },

  checkin: {
    status: () => request<{
      alreadyDone: boolean;
      streak: number;
      nextReward: { gold: number; diamonds: number; message: string };
      gold: number;
      diamonds: number;
    }>('/checkin'),
    perform: () => request<{
      alreadyDone: boolean;
      streak: number;
      reward?: { gold: number; diamonds: number; message: string };
      gold: number;
      diamonds: number;
    }>('/checkin', { method: 'POST' }),
  },
};
