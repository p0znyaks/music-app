import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { formatDurationCompact, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { toPlayerTracks } from '../../shared/utils/player-track.util';
import { TagsService, type TagSort } from '../../core/services/tags.service';
import { AppTrack } from '../../shared/models/track.model';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

interface TagsPlaylist {
  playlistName: string;
  tracks: AppTrack[];
}

/** Mirrors the server limit on tags per playlist query. */
const MAX_SELECTED_TAGS = 4;

@Component({
  selector: 'app-mood',
  standalone: true,
  imports: [
    CommonModule,
    TrackCardComponent,
    TranslatePipe,
    IconComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="page">
      <div class="head">
        <h1 class="title">{{ 'tagsTitle' | t }}</h1>
        <div class="sort">
          <button
            type="button"
            class="sort-btn"
            [class.active]="sort() === 'createdAt'"
            (click)="setSort('createdAt')"
          >
            {{ 'sortByDate' | t }}
          </button>
          <button
            type="button"
            class="sort-btn"
            [class.active]="sort() === 'alpha'"
            (click)="setSort('alpha')"
          >
            {{ 'sortAZ' | t }}
          </button>
        </div>
      </div>

      <div class="chips-wrap">
        @for (tag of tags(); track tag) {
          <button
            type="button"
            class="chip"
            [class.active]="isSelected(tag)"
            [disabled]="!isSelected(tag) && atTagLimit()"
            (click)="toggle(tag)"
          >
            #{{ tag }}
          </button>
        }
      </div>

      @if (atTagLimit()) {
        <p class="hint">{{ tagLimitHint() }}</p>
      }

      @if (tags().length === 0 && !loadingTags()) {
        <app-empty-state emoji="🏷️" titleKey="noTagsYet" />
      } @else if (selectedTags().length > 0) {
        @if (loadingPlaylist()) {
          <div class="list">
            <app-skeleton [count]="6" />
          </div>
        } @else if (playlist()) {
          <h2 class="playlist-title">{{ playlistTitle() }}</h2>
          <div class="meta-row meta-row--spaced">
            <span class="meta-pill">{{ trackCountLabel() }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-pill">{{ totalDurationLabel() }}</span>
          </div>
          <div class="action-row">
            <button
              type="button"
              class="btn"
              [disabled]="queueTracks().length === 0"
              (click)="playAll()"
            >
              <app-icon name="play" />
              <span>{{ 'playAll' | t }}</span>
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              [disabled]="queueTracks().length === 0"
              (click)="shuffleAll()"
            >
              <app-icon name="expand" />
              <span>{{ 'shuffle' | t }}</span>
            </button>
          </div>
          <div class="list">
            @for (t of playlist()?.tracks ?? []; track t.trackId) {
              <app-track-card
                [track]="t"
                [showDuration]="true"
                [queue]="queueTracks()"
                (favoriteRemoved)="onTrackSourceRemoved()"
              />
            }
          </div>
        }
      }
    </div>
  `,
  styleUrl: './mood.component.css',
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
    toPlayerTracks(this.playlist()?.tracks ?? []),
  );
  readonly trackCountLabel = computed(
    () => `${this.queueTracks().length} ${this.settings.t('tracksSuffix')}`,
  );
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.queueTracks().reduce(
      (sum, track) => sum + (normalizeDurationSeconds(track.duration) ?? 0),
      0,
    );
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

  /** Hint shown when the selection has reached the maximum. */
  readonly tagLimitHint = computed(() =>
    this.settings.t('maxTagsReached', { n: MAX_SELECTED_TAGS }),
  );

  /** True once the user has picked as many tags as the playlist can combine. */
  atTagLimit(): boolean {
    return this.selectedTags().length >= MAX_SELECTED_TAGS;
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
    } else if (cur.length >= MAX_SELECTED_TAGS) {
      // The server rejects more than this, so refuse here rather than showing
      // an empty playlist with no explanation.
      this.toast.show(this.settings.t('maxTagsReached', { n: MAX_SELECTED_TAGS }));
      return;
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
