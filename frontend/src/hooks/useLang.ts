import { useState, useEffect } from 'react';
import { getLang, setLang, onLangChange, t, type Lang, type Strings } from '../i18n';

export function useLang(): { lang: Lang; setLang: (l: Lang) => void; t: Strings } {
  const [lang, setLangState] = useState<Lang>(getLang());

  useEffect(() => {
    const unsub = onLangChange(() => setLangState(getLang()));
    return () => { unsub(); };
  }, []);

  return { lang, setLang, t: t() };
}

// Tiny toggle component helper — returns the opposite lang
export function toggleLang(current: Lang): Lang {
  return current === 'zh' ? 'en' : 'zh';
}
