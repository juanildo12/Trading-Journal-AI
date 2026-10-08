import { useLang } from '../i18n';
import { Globe } from 'lucide-react';

export default function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  const next = lang === 'en' ? 'es' : 'en';
  return (
    <button
      type="button"
      className={`btn btn-ghost${className}`}
      onClick={() => setLang(next)}
      title={lang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
      aria-label={lang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
    >
      <Globe size={16} aria-hidden="true" />
      {lang === 'en' ? 'ES' : 'EN'}
    </button>
  );
}
