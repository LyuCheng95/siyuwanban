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
    telegram: (initData: string) =>
      request<{ token: string; user: import('../types').User }>('/auth/telegram', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      }),
  },

  characters: {
    wizard: (message: string) =>
      request<{ reply: string; isComplete: boolean; characterData?: Record<string, unknown> }>(
        '/characters/wizard',
        { method: 'POST', body: JSON.stringify({ message }) }
      ),
    wizardReset: () =>
      request<{ ok: boolean }>('/characters/wizard/reset', { method: 'POST' }),
    create: (data: Record<string, unknown>) =>
      request<import('../types').Character>('/characters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    mine: () => request<import('../types').Character[]>('/characters/mine'),
    get: (id: string) => request<import('../types').Character>(`/characters/${id}`),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/characters/${id}`, { method: 'DELETE' }),
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
  },

  marketplace: {
    list: (params?: { sort?: string; page?: number; search?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
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
    createInvoice: (tierIndex: number) =>
      request<{ invoiceLink: string; tier: import('../types').PaymentTier }>(
        '/payments/create-invoice',
        { method: 'POST', body: JSON.stringify({ tierIndex }) }
      ),
  },

  images: {
    generate: (prompt: string) =>
      request<{ url: string }>('/images/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
  },
};
