import { zh } from './zh';
import { en } from './en';
import { api } from '../api/client';

export type Lang = 'zh' | 'en';
export type Strings = typeof zh;

const STORAGE_KEY = 'sywb_lang';

function detectDefaultLang(): Lang {
  // 1. User saved preference
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved === 'zh' || saved === 'en') return saved;

  // 2. Telegram language_code
  try {
    const tg = (window as any).Telegram?.WebApp;
    const langCode = tg?.initDataUnsafe?.user?.language_code as string | undefined;
    if (langCode && !langCode.startsWith('zh')) return 'en';
  } catch {}

  // 3. Browser language
  const bl = navigator.language || '';
  if (!bl.startsWith('zh')) return 'en';

  return 'zh';
}

// Singleton state
let currentLang: Lang = detectDefaultLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  // Notify server (fire-and-forget)
  api.auth.setLanguage(lang).catch(() => {});
  // Re-render subscribers
  listeners.forEach(fn => fn());
}

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(): Strings {
  return currentLang === 'en' ? en : zh;
}

// Helper to pick the right field from a character object
export function charField<T>(en: T | null | undefined, zh: T): T {
  return (currentLang === 'en' && en) ? en : zh;
}
