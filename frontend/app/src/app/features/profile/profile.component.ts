import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { AppLanguage, AppSettingsService, AppTheme } from '../../core/services/app-settings.service';
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
              <button type="button" class="option-btn" [class.active]="theme() === 'dark'" (click)="setTheme('dark')">
                {{ 'darkTheme' | t }}
              </button>
              <button type="button" class="option-btn" [class.active]="theme() === 'light'" (click)="setTheme('light')">
                {{ 'lightTheme' | t }}
              </button>
            </div>
          </div>

          <div class="setting-group">
            <h3 class="setting-heading">{{ 'applicationLanguage' | t }}</h3>
            <div class="setting-options">
              <button type="button" class="option-btn" [class.active]="language() === 'en'" (click)="setLanguage('en')">
                {{ 'english' | t }}
              </button>
              <button type="button" class="option-btn" [class.active]="language() === 'ru'" (click)="setLanguage('ru')">
                {{ 'russian' | t }}
              </button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      max-width: 720px;
    }
    .loader {
      color: var(--accent-dim);
      padding: 2rem;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--bg-hover), var(--border));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: 600;
      color: var(--accent);
      flex-shrink: 0;
    }
    .info {
      min-width: 0;
    }
    .username {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
      margin: 0 0 0.25rem 0;
    }
    .email {
      font-size: 1rem;
      color: var(--accent-dim);
      margin: 0 0 0.5rem 0;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--accent);
    }
    .stat-label {
      font-size: 0.85rem;
      color: var(--accent-dim);
    }
    .settings {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: grid;
      gap: 1.25rem;
    }
    .settings-title {
      margin: 0;
      font-size: 1.1rem;
      color: var(--accent);
    }
    .setting-group {
      display: grid;
      gap: 0.75rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .setting-heading {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--accent-dim);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .setting-options {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .option-btn {
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--accent-dim);
      border-radius: 8px;
      padding: 0.5rem 0.85rem;
      cursor: pointer;
      min-width: 120px;
    }
    .option-btn:hover {
      color: var(--accent);
      border-color: var(--accent-dim);
    }
    .option-btn.active {
      background: var(--bg-hover);
      color: var(--accent);
      border-color: var(--accent-dim);
    }
    @media (max-width: 640px) {
      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
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
