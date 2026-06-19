import React, { createContext, useContext, useState, useCallback } from 'react';
import { translations, type Language } from './translations';

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'de',
  toggleLang: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('restate-lang');
      return (saved === 'en' || saved === 'de') ? saved : 'de';
    } catch {
      return 'de';
    }
  });

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'de' ? 'en' : 'de';
      try { localStorage.setItem('restate-lang', next); } catch {}
      return next;
    });
  }, []);

  const t = useCallback((key: string): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry['de'] || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
