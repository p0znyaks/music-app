import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import {
  ListenHistoryCacheService,
  type CachedListenHistoryRow,
} from '../../core/services/listen-history-cache.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppTrack } from '../../shared/models/track.model';

interface HistoryRow {
  id: number;
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | null;
  listenedAt: string;
}

interface HistoryGroup {
  title: string;
  rows: HistoryRow[];
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, TrackCardComponent, TranslatePipe],
  template: `
    <div class="page">
      <h1>{{ 'historyTitle' | t }}</h1>
      <div class="search-box">
        <svg class="lens" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          [(ngModel)]="inputModel"
          (ngModelChange)="query.set($event)"
          [placeholder]="'searchHistoryPlaceholder' | t"
          class="inp"
          autocomplete="off"
        />
      </div>
      @if (loading()) {
        <p class="muted">{{ 'loading' | t }}</p>
      } @else {
        @if (groupedRows().length) {
          <div class="list">
            @for (group of groupedRows(); track group.title) {
              <section class="period">
                <h2>{{ group.title }}</h2>
                <div class="group">
                  @for (row of group.rows; track row.id) {
                    <app-track-card [track]="toTrack(row)" [showDuration]="true" [queue]="queueTracks()" />
                  }
                </div>
              </section>
            }
          </div>
        } @else {
          <p class="muted">{{ 'noHistoryYet' | t }}</p>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      background: var(--bg);
      min-height: 100%;
    }
    .page {
      padding: 0 1.5rem 0 2rem;
      max-width: 720px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.9rem;
    }
    .muted {
      color: var(--accent-dim);
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.85rem 1.05rem;
      transition: border-color 0.2s ease;
      margin-top: -4px;
    }
    .search-box:focus-within {
      border-color: #444;
    }
    .lens {
      width: 24px;
      height: 24px;
      color: var(--accent-dim);
      flex-shrink: 0;
    }
    .inp {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 1.12rem;
      font-weight: 500;
      outline: none;
    }
    .inp::placeholder {
      color: var(--accent-dim);
      font-weight: 400;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .period {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h2 {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent-dim);
      margin: 0;
    }
  `,
})
export class HistoryComponent {
  private readonly api = inject(ApiService);
  private readonly player = inject(PlayerService);
  private readonly listenHistoryCache = inject(ListenHistoryCacheService);
  private readonly settings = inject(AppSettingsService);

  readonly rows = signal<HistoryRow[]>([]);
  readonly loading = signal(true);
  readonly query = signal('');
  inputModel = '';

  readonly filteredRows = computed(() => this.applyQueryFilter(this.rows(), this.query()));
  readonly groupedRows = computed<HistoryGroup[]>(() => this.buildGroups(this.filteredRows()));
  readonly queueTracks = computed<PlayerTrack[]>(() => this.rows().map((row) => this.toPlayerTrack(row)));

  constructor() {
    this.api.get<CachedListenHistoryRow[]>('history').subscribe({
      next: (list) => {
        this.rows.set(this.listenHistoryCache.mergeAndPersist(list));
        this.loading.set(false);
      },
      error: () => {
        this.rows.set(this.listenHistoryCache.mergeAndPersist([]));
        this.loading.set(false);
      },
    });
  }

  toTrack(row: HistoryRow): AppTrack {
    return {
      trackId: row.trackId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl,
      duration: normalizeDurationSeconds(row.duration) ?? undefined,
    };
  }

  private toPlayerTrack(row: HistoryRow): PlayerTrack {
    return {
      trackId: row.trackId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl ?? undefined,
    };
  }

  private applyQueryFilter(rows: HistoryRow[], rawQuery: string): HistoryRow[] {
    const q = rawQuery.trim().toLowerCase();
    if (!q) {
      return rows;
    }

    return rows.filter((r) => {
      const title = (r.title ?? '').toLowerCase();
      const artist = (r.artist ?? '').toLowerCase();
      return title.includes(q) || artist.includes(q);
    });
  }

  private buildGroups(rows: HistoryRow[]): HistoryGroup[] {
    const uniqueRows = this.dedupeLatestPerTrackInDay(rows);
    const grouped = new Map<string, HistoryRow[]>();

    for (const row of uniqueRows) {
      const listenedAt = new Date(row.listenedAt);
      if (Number.isNaN(listenedAt.getTime())) {
        continue;
      }

      const title = this.getPeriodTitle(listenedAt);
      const groupRows = grouped.get(title) ?? [];
      groupRows.push(row);
      grouped.set(title, groupRows);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => this.compareGroupTitles(a, b))
      .map(([title, groupRows]) => ({ title, rows: groupRows }));
  }

  private dedupeLatestPerTrackInDay(rows: HistoryRow[]): HistoryRow[] {
    const sorted = [...rows].sort(
      (a, b) => new Date(b.listenedAt).getTime() - new Date(a.listenedAt).getTime(),
    );
    const seen = new Set<string>();
    const result: HistoryRow[] = [];

    for (const row of sorted) {
      const listenedAt = new Date(row.listenedAt);
      if (Number.isNaN(listenedAt.getTime())) {
        continue;
      }

      const key = `${this.toDateKey(listenedAt)}|${row.trackId}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(row);
    }

    return result;
  }

  private getPeriodTitle(date: Date): string {
    const todayStart = this.startOfDay(new Date());
    const dateStart = this.startOfDay(date);
    const diffDays = Math.floor((todayStart.getTime() - dateStart.getTime()) / 86400000);

    if (diffDays === 0) {
      return this.settings.t('today');
    }
    if (diffDays === 1) {
      return this.settings.t('yesterday');
    }
    if (diffDays >= 2 && diffDays <= 7) {
      return this.settings.t('lastWeek');
    }

    return `${date.getFullYear()} / ${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private compareGroupTitles(a: string, b: string): number {
    const today = this.settings.t('today');
    const yesterday = this.settings.t('yesterday');
    const lastWeek = this.settings.t('lastWeek');
    const rank = (title: string): number => {
      if (title === today) {
        return 0;
      }
      if (title === yesterday) {
        return 1;
      }
      if (title === lastWeek) {
        return 2;
      }
      return 3;
    };

    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    if (rank(a) < 3) {
      return 0;
    }

    return b.localeCompare(a);
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
