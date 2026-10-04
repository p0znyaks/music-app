import { Injectable, computed, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';
export type AppLanguage = 'en' | 'ru';

import { FALLBACK_TRANSLATIONS, TRANSLATIONS } from '../i18n/translations';

const THEME_STORAGE_KEY = 'app.settings.theme';
const LANGUAGE_STORAGE_KEY = 'app.settings.language';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly _theme = signal<AppTheme>(this.readTheme());
  private readonly _language = signal<AppLanguage>(this.readLanguage());

  readonly theme = this._theme.asReadonly();
  readonly language = this._language.asReadonly();
  readonly isDarkTheme = computed(() => this._theme() === 'dark');

  constructor() {
    this.applyTheme(this._theme());
    document.documentElement.lang = this._language();
  }

  setTheme(theme: AppTheme): void {
    this._theme.set(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    this.applyTheme(theme);
  }

  setLanguage(language: AppLanguage): void {
    this._language.set(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }

  /** Looks up a translation and substitutes `{name}` placeholders. */
  t(key: string, params?: Record<string, string | number>): string {
    const language = this._language();
    const template = TRANSLATIONS[language][key] ?? FALLBACK_TRANSLATIONS[key] ?? key;
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
      params[name] === undefined ? match : String(params[name]),
    );
  }

  private readTheme(): AppTheme {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  }

  private readLanguage(): AppLanguage {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'ru' || stored === 'en' ? stored : 'ru';
  }

  private applyTheme(theme: AppTheme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
