import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'couple-games:theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.readInitial());
  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', t);
      }
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        // ignore — private mode or storage disabled
      }
    });
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }

  toggle(): void {
    this._theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  private readInitial(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }
}
