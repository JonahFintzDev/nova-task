// node_modules
import { createI18n } from 'vue-i18n';

// locales
import de from '@/locales/de';
import en from '@/locales/en';

export type LocaleCode = 'en' | 'de';

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, de },
});

export function detectBrowserLocale(): LocaleCode {
  const raw = navigator.language?.slice(0, 2).toLowerCase() ?? 'en';
  if (raw === 'de') {
    return 'de';
  }
  return 'en';
}

export function setLocale(code: LocaleCode): void {
  i18n.global.locale.value = code;
}
