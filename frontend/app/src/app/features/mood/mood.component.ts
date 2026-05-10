import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { formatDurationCompact, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { TagsService, type TagSort } from '../../core/services/tags.service';
import { AppTrack } from '../../shared/models/track.model';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ToastService } from '../../core/services/toast.service';

interface TagsPlaylist {
  playlistName: string;
  tracks: AppTrack[];
}

@Component({
  selector: 'app-mood',
  standalone: true,
  imports: [CommonModule, TrackCardComponent, TranslatePipe],
  template: `
    <div class="page">
      <div class="head">
        <h1 class="title">{{ 'tagsTitle' | t }}</h1>
        <div class="sort">
          <button type="button" class="sort-btn" [class.active]="sort() === 'createdAt'" (click)="setSort('createdAt')">{{ 'sortByDate' | t }}</button>
          <button type="button" class="sort-btn" [class.active]="sort() === 'alpha'" (click)="setSort('alpha')">{{ 'sortAZ' | t }}</button>
        </div>
      </div>

      <div class="chips-wrap">
        @for (tag of tags(); track tag) {
          <button type="button" class="chip" [class.active]="isSelected(tag)" (click)="toggle(tag)">
            #{{ tag }}
          </button>
        }
      </div>

      @if (tags().length === 0 && !loadingTags()) {
        <div class="empty">
          <span class="empty-icon" aria-hidden="true">🏷️</span>
          <p class="empty-title">{{ 'noTagsYet' | t }}</p>
        </div>
      } @else if (selectedTags().length > 0) {
        @if (loadingPlaylist()) {
          <div class="loader-wrap">
            <svg class="spinner" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
            </svg>
          </div>
        } @else if (playlist()) {
          <h2 class="playlist-title">{{ playlistTitle() }}</h2>
          <div class="meta-row">
            <span class="meta-pill">{{ trackCountLabel() }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-pill">{{ totalDurationLabel() }}</span>
          </div>
          <div class="action-row">
            <button type="button" class="action-btn tap" [disabled]="queueTracks().length === 0" (click)="playAll()">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2l10 6-10 6V2z"/></svg>
              <span>{{ 'playAll' | t }}</span>
            </button>
            <button type="button" class="action-btn alt tap" [disabled]="queueTracks().length === 0" (click)="shuffleAll()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
              <span>{{ 'shuffle' | t }}</span>
            </button>
          </div>
          <div class="list">
            @for (t of playlist()?.tracks ?? []; track t.trackId) {
              <app-track-card [track]="t" [queue]="queueTracks()" (favoriteRemoved)="onTrackSourceRemoved()" />
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      max-width: 720px;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
    .title {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0;
    }
    .sort {
      display: flex;
      gap: 8px;
    }
    .sort-btn {
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent-dim);
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .sort-btn.active {
      background: var(--accent);
      color: var(--bg);
      border-color: var(--accent);
    }
    .chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 1.25rem;
    }
    .chip {
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-hover);
      color: var(--accent);
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    }
    .chip:hover {
      background: var(--bg-card);
    }
    .chip.active {
      background: var(--accent);
      color: var(--bg);
      border-color: var(--accent);
    }
    .empty {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 1rem;
      opacity: 0.8;
    }
    .empty-title {
      font-size: 1rem;
      color: var(--accent-dim);
    }
    .loader-wrap {
      display: flex;
      justify-content: center;
      padding: 3rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      color: var(--accent-dim);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .playlist-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--accent);
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.7rem;
    }
    .meta-pill {
      font-size: 0.86rem;
      color: var(--accent-dim);
    }
    .meta-sep {
      color: var(--accent-dim);
      opacity: 0.7;
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      margin-bottom: 1.5rem;
      align-items: center;
    }
    .action-btn {
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent);
      border-radius: 999px;
      height: 40px;
      padding: 0 1rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        background 0.2s ease,
        color 0.2s ease,
        transform 0.12s ease;
    }
    .action-btn svg {
      width: 16px;
      height: 16px;
    }
    .action-btn:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--accent-dim);
      color: var(--accent);
    }
    .action-btn.alt svg {
      width: 15px;
      height: 15px;
    }
    .action-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .action-btn.tap:active:not(:disabled) {
      transform: scale(0.97);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `,
})
export class MoodComponent {
  private readonly api = inject(ApiService);
  private readonly player = inject(PlayerService);
  private readonly tagsService = inject(TagsService);
  private readonly settings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);

  readonly tags = signal<string[]>([]);
  readonly loadingTags = signal(true);
  readonly sort = signal<TagSort>('createdAt');
  readonly selectedTags = signal<string[]>([]);
  readonly playlist = signal<TagsPlaylist | null>(null);
  readonly loadingPlaylist = signal(false);

  readonly queueTracks = computed<PlayerTrack[]>(() =>
    (this.playlist()?.tracks ?? []).map((track) => ({
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      thumbnailUrl: track.thumbnailUrl ?? undefined,
      duration: normalizeDurationSeconds(track.duration) ?? undefined,
    })),
  );
  readonly trackCountLabel = computed(() => `${this.queueTracks().length} ${this.settings.t('tracksSuffix')}`);
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.queueTracks().reduce((sum, track) => sum + (normalizeDurationSeconds(track.duration) ?? 0), 0);
    return formatDurationCompact(totalSec);
  });

  constructor() {
    this.loadTags();
  }

  readonly playlistTitle = computed(() => {
    const tags = this.selectedTags();
    if (tags.length === 0) return '';
    return `${this.settings.t('playlistByTagsPrefix')}: ${tags.join(' + ')}`;
  });

  setSort(s: TagSort): void {
    this.sort.set(s);
    this.loadTags();
  }

  private loadTags(): void {
    this.loadingTags.set(true);
    this.tagsService.getDistinctTags(this.sort()).subscribe({
      next: (list) => {
        this.tags.set(list ?? []);
        this.loadingTags.set(false);
      },
      error: () => this.loadingTags.set(false),
    });
  }

  isSelected(tag: string): boolean {
    const n = tag.trim().toLowerCase();
    return this.selectedTags().some((t) => t.trim().toLowerCase() === n);
  }

  toggle(tag: string): void {
    const t = tag.trim();
    if (!t) return;
    const cur = this.selectedTags();
    const n = t.toLowerCase();
    const idx = cur.findIndex((x) => x.trim().toLowerCase() === n);
    if (idx >= 0) {
      const next = [...cur.slice(0, idx), ...cur.slice(idx + 1)];
      this.selectedTags.set(next);
    } else {
      this.selectedTags.set([...cur, t]);
    }
    this.loadPlaylist();
  }

  private loadPlaylist(): void {
    const tags = this.selectedTags();
    if (tags.length === 0) {
      this.playlist.set(null);
      return;
    }
    this.playlist.set(null);
    this.loadingPlaylist.set(true);
    const qs = tags.map((t) => `tags=${encodeURIComponent(t)}`).join('&');
    this.api.get<TagsPlaylist>(`tags/playlist?${qs}`).subscribe({
      next: (data) => {
        this.playlist.set(data);
        this.loadingPlaylist.set(false);
      },
      error: () => this.loadingPlaylist.set(false),
    });
  }

  playAll(): void {
    if (this.queueTracks().length === 0) {
      return;
    }
    this.player.startQueue(this.queueTracks());
  }

  shuffleAll(): void {
    if (this.queueTracks().length === 0) {
      return;
    }
    this.player.startQueue(this.queueTracks(), { shuffle: true });
  }

  onTrackSourceRemoved(): void {
    this.loadTags();
    this.loadPlaylist();
  }
}
