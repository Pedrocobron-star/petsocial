/**
 * Pet Social i18n — provider, hook e API de tradução.
 *
 * Por que custom (sem react-i18next): app é médio, queremos zero overhead de
 * runtime e tipos fortes vindo direto dos arquivos .ts. Quando crescer (>500
 * keys ou plurals complexos), migrar pra react-i18next ou Lingui é trivial.
 *
 * Uso:
 *   const { t, locale, setLocale } = useTranslation();
 *   t('welcome.hero.title');
 *   t('account.preferences.notifications');
 *
 * Mudança de idioma é instantânea — provider re-renderiza tudo consumidor.
 *
 * Locale resolution:
 *  1. AsyncStorage (escolha do user)
 *  2. expo-localization (idioma do device)
 *  3. 'pt-BR' (default)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { enUS } from './locales/en-US';
import { esES } from './locales/es-ES';
import { ptBR, type TranslationKeys } from './locales/pt-BR';

export type Locale = 'pt-BR' | 'en-US' | 'es-ES';
export const SUPPORTED_LOCALES: Locale[] = ['pt-BR', 'en-US', 'es-ES'];
const DEFAULT_LOCALE: Locale = 'pt-BR';
const STORAGE_KEY = 'pet-social.locale';

const DICTIONARIES: Record<Locale, TranslationKeys> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es-ES': esES,
};

/**
 * Gera todos os paths de chaves recursivamente — dá autocomplete TS
 * pra `t('welcome.hero.title')`.
 */
type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${Path<T[K]>}` | K
          : K
        : never;
    }[keyof T]
  : never;

export type TranslationKey = Path<TranslationKeys>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
  /** Locale ainda carregando da storage. Usado pra suspender renders se quiser. */
  isReady: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Provider — envolve toda a árvore. Faz hidratação async do locale do storage
 * antes de marcar isReady=true.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isReady, setIsReady] = useState(false);

  // Hydrate locale on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readStoredLocale();
      const initial = stored ?? detectDeviceLocale() ?? DEFAULT_LOCALE;
      if (!cancelled) {
        setLocaleState(initial);
        setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    setLocaleState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort
    }
  }, []);

  const t = useCallback<I18nContextValue['t']>(
    (key, replacements) => {
      const dict = DICTIONARIES[locale];
      const raw = lookup(dict, key) ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key) ?? key;
      return interpolate(raw, replacements);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t, isReady }), [
    locale,
    setLocale,
    t,
    isReady,
  ]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Hook principal. */
export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used inside I18nProvider');
  }
  return ctx;
}

/** Versão segura: retorna defaults se chamada fora do provider (útil em testes). */
export function useTranslationOptional(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    setLocale: async () => undefined,
    t: (key) => key,
    isReady: false,
  };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function lookup(dict: TranslationKeys, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, replacements?: Record<string, string | number>): string {
  if (!replacements) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const val = replacements[name];
    return val != null ? String(val) : `{${name}}`;
  });
}

async function readStoredLocale(): Promise<Locale | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LOCALES as string[]).includes(stored)) {
      return stored as Locale;
    }
  } catch {
    // ignora
  }
  return null;
}

function detectDeviceLocale(): Locale | null {
  try {
    const locales = getLocales();
    for (const l of locales) {
      const tag = l.languageTag;
      if (tag.startsWith('pt')) return 'pt-BR';
      if (tag.startsWith('en')) return 'en-US';
      if (tag.startsWith('es')) return 'es-ES';
    }
  } catch {
    // ignora
  }
  return null;
}
