import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, langLabels, FONT_BY_LANG } from '../i18n/translations';

const STORAGE_KEY = 'pos_lang';
const LANGS = ['tw', 'kr', 'en'];

const LocaleContext = createContext(null);

const fallbackT = (key) => translations.tw?.[key] ?? key;
const fallbackLocale = { lang: 'tw', setLang: () => {}, t: fallbackT, langLabels, LANGS };

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.includes(saved)) return saved;
    } catch (_) {}
    return 'tw';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
    document.documentElement.dataset.lang = lang;
    document.documentElement.style.setProperty('--font-cute', FONT_BY_LANG[lang]);
  }, [lang]);

  const setLang = (l) => {
    if (LANGS.includes(l)) setLangState(l);
  };

  const t = (key) => translations[lang]?.[key] ?? translations.tw?.[key] ?? key;

  return (
    <LocaleContext.Provider value={{ lang, setLang, t, langLabels, LANGS }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) return fallbackLocale;
  return ctx;
}
