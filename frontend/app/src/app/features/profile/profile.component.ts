import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import {
  AppLanguage,
  AppSettingsService,
  AppTheme,
} from '../../core/services/app-settings.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

interface ProfileData {
  id: number;
  username: string;
  email: string;
  stats: {
    totalListened: number;
    uniqueTracks: number;
    totalPlaylists: number;
    totalFavorites: number;
  };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="page">
      @if (loading()) {
        <div class="loader">{{ 'loading' | t }}</div>
      } @else if (profile(); as p) {
        <div class="header">
          <div class="avatar">{{ avatarLetter() }}</div>
          <div class="info">
            <h1 class="username">{{ p.username }}</h1>
            <p class="email">{{ p.email }}</p>
          </div>
        </div>
        <div class="stats">
          <div class="stat-card">
            <span class="stat-value">{{ p.stats.totalListened }}</span>
            <span class="stat-label">{{ 'tracksListened' | t }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ p.stats.uniqueTracks }}</span>
            <span class="stat-label">{{ 'uniqueTracks' | t }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ p.stats.totalPlaylists }}</span>
            <span class="stat-label">{{ 'playlists' | t }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ p.stats.totalFavorites }}</span>
            <span class="stat-label">{{ 'favorites' | t }}</span>
          </div>
        </div>

        <section class="settings">
          <h2 class="settings-title">{{ 'settings' | t }}</h2>

          <div class="setting-group">
            <h3 class="setting-heading">{{ 'appearance' | t }}</h3>
            <div class="setting-options">
              <button
                type="button"
                class="option-btn"
                [class.active]="theme() === 'dark'"
                (click)="setTheme('dark')"
              >
                {{ 'darkTheme' | t }}
              </button>
              <button
                type="button"
                class="option-btn"
                [class.active]="theme() === 'light'"
                (click)="setTheme('light')"
              >
                {{ 'lightTheme' | t }}
              </button>
            </div>
          </div>

          <div class="setting-group">
            <h3 class="setting-heading">{{ 'applicationLanguage' | t }}</h3>
            <div class="setting-options">
              <button
                type="button"
                class="option-btn"
                [class.active]="language() === 'en'"
                (click)="setLanguage('en')"
              >
                {{ 'english' | t }}
              </button>
              <button
                type="button"
                class="option-btn"
                [class.active]="language() === 'ru'"
                (click)="setLanguage('ru')"
              >
                {{ 'russian' | t }}
              </button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  private readonly api = inject(ApiService);
  private readonly settings = inject(AppSettingsService);

  readonly profile = signal<ProfileData | null>(null);
  readonly loading = signal(true);
  readonly theme = this.settings.theme;
  readonly language = this.settings.language;

  avatarLetter(): string {
    const p = this.profile();
    if (!p?.username) return '?';
    return p.username.charAt(0).toUpperCase();
  }

  setTheme(theme: AppTheme): void {
    this.settings.setTheme(theme);
  }

  setLanguage(language: AppLanguage): void {
    this.settings.setLanguage(language);
  }

  constructor() {
    this.api.get<ProfileData>('profile').subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
