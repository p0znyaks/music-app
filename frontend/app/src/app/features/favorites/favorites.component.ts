import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { AppTrack } from '../../shared/models/track.model';
import { formatDurationCompact, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { toPlayerTracks } from '../../shared/utils/player-track.util';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-favorites',
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
      <h1>{{ 'favorites' | t }}</h1>
      <div class="favorites-meta">
        <div class="meta-row meta-row--spaced">
          <span class="meta-pill">{{ trackCountLabel() }}</span>
          <span class="meta-sep">·</span>
          <span class="meta-pill">{{ totalDurationLabel() }}</span>
        </div>
        <div class="action-row">
          <button
            type="button"
            class="action-btn tap"
            [disabled]="tracks().length === 0"
            (click)="playAll()"
          >
            <app-icon name="play" />
            <span>{{ 'playAll' | t }}</span>
          </button>
          <button
            type="button"
            class="action-btn alt tap"
            [disabled]="tracks().length === 0"
            (click)="shuffleAll()"
          >
            <app-icon name="expand" />
            <span>{{ 'shuffle' | t }}</span>
          </button>
        </div>
      </div>
      @if (loading()) {
        <div class="list">
          <app-skeleton [count]="6" />
        </div>
      } @else if (tracks().length === 0) {
        <app-empty-state emoji="❤️" titleKey="favoritesEmptyTitle" subKey="favoritesEmptySub" />
      } @else {
        <div class="list">
          @for (t of tracks(); track t.trackId) {
            <app-track-card
              [track]="t"
              [showDuration]="true"
              [allowTagging]="true"
              [queue]="queueTracks()"
              (favoriteRemoved)="load()"
            />
          }
        </div>
      }
    </div>
  `,
  styleUrl: './favorites.component.css',
})
export class FavoritesComponent {
  private readonly api = inject(ApiService);
  private readonly favorites = inject(FavoritesService);
  private readonly player = inject(PlayerService);
  private readonly settings = inject(AppSettingsService);

  readonly tracks = signal<AppTrack[]>([]);
  readonly loading = signal(true);
  readonly queueTracks = computed<PlayerTrack[]>(() => toPlayerTracks(this.tracks()));
  readonly trackCountLabel = computed(
    () => `${this.tracks().length} ${this.settings.t('tracksSuffix')}`,
  );
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.tracks().reduce(
      (sum, track) => sum + (normalizeDurationSeconds(track.duration) ?? 0),
      0,
    );
    return formatDurationCompact(totalSec);
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .get<
        {
          trackId: string;
          title: string;
          artist: string;
          thumbnailUrl: string | null;
          duration: number | null;
          startTime?: number | null;
          endTime?: number | null;
          addedAt?: string | null;
        }[]
      >('favorites')
      .subscribe({
        next: (list) => {
          this.favorites.setFavorites(list.map((r) => r.trackId));

          this.tracks.set(
            list.map((r) => ({
              trackId: r.trackId,
              title: r.title,
              artist: r.artist,
              thumbnailUrl: r.thumbnailUrl,
              duration: normalizeDurationSeconds(r.duration) ?? undefined,
              startTime: r.startTime ?? undefined,
              endTime: r.endTime ?? undefined,
            })),
          );
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  playAll(): void {
    this.player.startQueue(this.queueTracks());
  }

  shuffleAll(): void {
    this.player.startQueue(this.queueTracks(), { shuffle: true });
  }
}
