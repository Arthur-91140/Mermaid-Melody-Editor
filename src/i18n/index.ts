import { useCallback } from 'react';
import { useSettings } from '../store/settings';
import { en } from './en';
import { fr, type Dictionary, type TranslationKey } from './fr';

export type Language = 'fr' | 'en';
export type { TranslationKey };

const DICTIONARIES: Record<Language, Dictionary> = { fr, en };

export function detectLanguage(): Language {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'fr';
  return nav.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function translate(lang: Language, key: TranslationKey, vars?: Record<string, string | number>): string {
  let s = DICTIONARIES[lang][key] ?? fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function useT(): Translate {
  const lang = useSettings((s) => s.language);
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

/** Translates a key that is built at runtime (e.g. `shape.${name}`), falling back to `fallback`. */
export function tryT(t: Translate, key: string, fallback: string): string {
  return key in fr ? t(key as TranslationKey) : fallback;
}
