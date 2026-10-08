import { createContext, useContext, useState, useEffect } from 'react';
import es from './es.json';
import en from './en.json';

const translations = { es, en };
const LangContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang');
    return saved === 'es' || saved === 'en' ? saved : 'en';
  });
  useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
  const t = (key, fallback) => {
    const v = getNested(translations[lang], key);
    if (v !== undefined) return v;
    return fallback !== undefined ? fallback : key;
  };
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
