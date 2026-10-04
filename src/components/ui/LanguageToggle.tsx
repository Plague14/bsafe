import clsx from 'clsx';
import { useI18n, type Lang } from '../../i18n';

/** EN | PT-BR switch. English is the default; the choice is remembered in this browser. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const options: Lang[] = ['en', 'pt'];

  return (
    <div
      role="group"
      aria-label={t('language.label')}
      className={clsx('inline-flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold', className)}
    >
      {options.map(option => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={clsx(
            'px-2.5 py-1 rounded-md transition-colors',
            lang === option ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-primary-700'
          )}
        >
          {t(`language.${option}`)}
        </button>
      ))}
    </div>
  );
}
