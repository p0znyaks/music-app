import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { BackNavigationService } from '../../../core/services/back-navigation.service';
import { PlayerService, type PlayerTrack } from '../../../core/services/player.service';
import { TagsService } from '../../../core/services/tags.service';
import { AppTrack } from '../../../shared/models/track.model';
import {
  formatDurationCompact,
  normalizeDurationSeconds,
} from '../../../shared/utils/duration.util';
import { toPlayerTracks } from '../../../shared/utils/player-track.util';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { TrackCardComponent } from '../../../shared/components/track-card/track-card.component';
import { TranslatePipe } from '../../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { parseErrorPayload } from '../../../shared/utils/error-payload.util';

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TrackCardComponent,
    ModalComponent,
    TranslatePipe,
    IconComponent,
  ],
  template: `
    <div class="page">
      <div class="head">
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
        <h1>{{ title() }}</h1>
        @if (!isMix()) {
          <button type="button" class="del-btn tap" (click)="askDelete()">
            {{ 'deletePlaylist' | t }}
          </button>
        }
      </div>

      <div class="playlist-meta">
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

      <div class="list">
        @for (row of tracks(); track row.trackId + '-' + row.id) {
          <div class="row">
            <app-track-card
              class="grow"
              [track]="toAppTrack(row)"
              [showDuration]="true"
              [inPlaylist]="true"
              [allowTagging]="!isMix()"
              [queue]="queueTracks()"
            />
            @if (!isMix()) {
              <button
                type="button"
                class="rm list-rm tap"
                (click)="removeTrack(row.trackId)"
                [title]="'remove' | t"
                [attr.aria-label]="'remove' | t"
              >
                <app-icon name="trash" [size]="18" />
              </button>
            }
          </div>
        }
      </div>
    </div>

    @if (confirming()) {
      <div
        class="modal-backdrop"
        role="button"
        tabindex="0"
        aria-label="cancel"
        (click)="cancelDelete($event)"
        (keydown.escape)="cancelDelete()"
      >
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-title">{{ 'deletePlaylistTitle' | t }}</div>
          <div class="modal-text">{{ 'deletePlaylistConfirm' | t }}</div>
          <div class="modal-actions">
            <button type="button" class="btn ghost tap" (click)="cancelDelete()">
              {{ 'no' | t }}
            </button>
            <button type="button" class="btn danger tap" (click)="confirmDelete()">
              {{ 'yes' | t }}
            </button>
          </div>
        </div>
      </div>
    }

    <app-modal
      [title]="'trackHasTags' | t"
      [isOpen]="confirmOpen()"
      (closed)="confirmOpen.set(false)"
    >
      <p>{{ 'removeTrackWithTagsConfirm' | t }}</p>
      <div class="confirm-row">
        <button type="button" class="rm ghost" (click)="confirmOpen.set(false)">
          {{ 'no' | t }}
        </button>
        <button type="button" class="rm danger" (click)="confirmRemove()">{{ 'yes' | t }}</button>
      </div>
    </app-modal>
  `,
  styleUrl: './playlist-detail.component.css',
})
export class PlaylistDetailComponent {
  readonly api = inject(ApiService);
  readonly tags = inject(TagsService);
  readonly player = inject(PlayerService);
  readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly route = inject(ActivatedRoute);

  readonly playlistId = signal<number>(0);
  readonly mixId = signal<string | null>(null);
  readonly isMix = computed(() => this.mixId() !== null);
  readonly title = signal(this.settings.t('playlists'));
  readonly tracks = signal<
    {
      id: number;
      trackId: string;
      title: string;
      artist: string;
      thumbnailUrl: string | null;
      duration: number | null;
      startTime?: number | null;
      endTime?: number | null;
      addedAt?: string | null;
    }[]
  >([]);

  readonly confirmOpen = signal(false);
  readonly pendingRemoveTrackId = signal<string | null>(null);
  readonly queueTracks = computed<PlayerTrack[]>(() => toPlayerTracks(this.tracks()));
  readonly trackCountLabel = computed(
    () => `${this.tracks().length} ${this.settings.t('tracksSuffix')}`,
  );
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.tracks().reduce(
      (sum, row) => sum + (normalizeDurationSeconds(row.duration) ?? 0),
      0,
    );
    return formatDurationCompact(totalSec);
  });

  readonly confirming = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    const url = this.router.url;
    const isMix = url.startsWith('/mixes/');
    if (isMix) {
      if (!id) {
        void this.router.navigate(['/']);
        return;
      }
      this.mixId.set(id);
      this.title.set(this.mixBaseTitle());
    } else {
      const pid = id ? parseInt(id, 10) : NaN;
      if (!Number.isFinite(pid)) {
        void this.router.navigate(['/playlists']);
        return;
      }
      this.playlistId.set(pid);
      const st = history.state as { name?: string } | undefined;
      if (st?.name) {
        this.title.set(st.name);
      }
      this.loadTitle();
    }
    this.loadTracks();
  }

  private loadTitle(): void {
    const pid = this.playlistId();
    this.api.get<{ id: number; name: string; createdAt: string }[]>('playlists').subscribe({
      next: (list) => {
        const current = list.find((p) => p.id === pid);
        if (current?.name?.trim()) {
          this.title.set(current.name);
          return;
        }
        this.title.set(`${this.settings.t('playlists')} #${pid}`);
      },
      error: () => {
        if (this.title() === this.playlistBaseTitle()) {
          this.title.set(`${this.settings.t('playlists')} #${pid}`);
        }
      },
    });
  }

  loadTracks(): void {
    const mid = this.mixId();
    if (mid) {
      this.api
        .get<
          {
            id: number;
            trackId: string;
            title: string;
            artist: string;
            thumbnailUrl: string | null;
            duration: number | null;
            startTime?: number | null;
            endTime?: number | null;
            addedAt?: string | null;
          }[]
        >(`reco/mixes/${encodeURIComponent(mid)}`)
        .subscribe({
          next: (list) => {
            this.tracks.set(list);
            const m = /-(\d+)$/.exec(mid);
            const n = m ? parseInt(m[1], 10) : NaN;
            if (Number.isFinite(n)) {
              this.title.set(`${this.mixBaseTitle()} #${n}`);
            } else if (this.title() === this.mixBaseTitle()) {
              this.title.set(this.mixBaseTitle());
            }
          },
        });
      return;
    }

    const pid = this.playlistId();
    this.api
      .get<
        {
          id: number;
          trackId: string;
          title: string;
          artist: string;
          thumbnailUrl: string | null;
          duration: number | null;
          startTime?: number | null;
          endTime?: number | null;
          addedAt?: string | null;
        }[]
      >(`playlists/${pid}/tracks`)
      .subscribe({
        next: (list) => {
          this.tracks.set(list);
          if (this.title() === this.playlistBaseTitle() && !history.state?.name) {
            this.title.set(`${this.settings.t('playlists')} #${pid}`);
          }
          const missing = list.filter((t) => t.duration == null).slice(0, 10);
          if (missing.length > 0) {
            forkJoin(
              missing.map((t) =>
                this.api
                  .get<{ duration: number }>(`tracks/${encodeURIComponent(t.trackId)}/metadata`)
                  .pipe(
                    map((meta) => {
                      const d = normalizeDurationSeconds(meta.duration);
                      return d != null ? { index: list.indexOf(t), duration: d } : null;
                    }),
                    catchError(() => of(null)),
                  ),
              ),
            ).subscribe((results) => {
              const updated = [...this.tracks()];
              for (const r of results) {
                if (r) {
                  updated[r.index] = { ...updated[r.index], duration: r.duration };
                }
              }
              this.tracks.set(updated);
            });
          }
        },
      });
  }

  private playlistBaseTitle(): string {
    return this.settings.t('playlists');
  }

  private mixBaseTitle(): string {
    return this.settings.t('homeMixesForYou');
  }

  toAppTrack(row: {
    trackId: string;
    title: string;
    artist: string;
    thumbnailUrl: string | null;
    duration: number | null;
    startTime?: number | null;
    endTime?: number | null;
  }): AppTrack {
    return {
      trackId: row.trackId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl,
      duration: normalizeDurationSeconds(row.duration) ?? undefined,
      startTime: row.startTime ?? undefined,
      endTime: row.endTime ?? undefined,
    };
  }

  playAll(): void {
    this.player.startQueue(this.queueTracks());
  }

  shuffleAll(): void {
    this.player.startQueue(this.queueTracks(), { shuffle: true });
  }

  removeTrack(trackId: string): void {
    if (this.mixId()) {
      return;
    }
    const pid = this.playlistId();
    const enc = encodeURIComponent(trackId);
    this.api.delete(`playlists/${pid}/tracks/${enc}`).subscribe({
      next: () => {
        this.tags.invalidate();
        this.loadTracks();
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse && err.status === 409) {
          const payload = parseErrorPayload(err);
          if (payload?.requiresConfirm) {
            this.pendingRemoveTrackId.set(trackId);
            this.confirmOpen.set(true);
          }
        }
      },
    });
  }

  confirmRemove(): void {
    if (this.mixId()) {
      this.confirmOpen.set(false);
      this.pendingRemoveTrackId.set(null);
      return;
    }
    const trackId = this.pendingRemoveTrackId();
    if (!trackId) {
      return;
    }
    const pid = this.playlistId();
    const enc = encodeURIComponent(trackId);
    this.api.delete(`playlists/${pid}/tracks/${enc}?force=1`).subscribe({
      next: () => {
        this.tags.invalidate();
        this.confirmOpen.set(false);
        this.pendingRemoveTrackId.set(null);
        this.loadTracks();
      },
      error: () => {
        this.confirmOpen.set(false);
        this.pendingRemoveTrackId.set(null);
      },
    });
  }

  back(): void {
    if (this.mixId()) {
      this.backNavigation.back('/');
      return;
    }
    this.backNavigation.back('/playlists');
  }

  askDelete(): void {
    this.confirming.set(true);
  }

  /**
   * Cancels the delete confirmation. When invoked from the backdrop the click
   * target is checked so that clicks inside the dialog are ignored, rather than
   * attaching a no-op click handler to the dialog element.
   */
  cancelDelete(event?: Event): void {
    const target = event?.target as HTMLElement | null;
    if (event && target?.closest('.modal')) {
      return;
    }
    this.confirming.set(false);
  }

  confirmDelete(): void {
    const pid = this.playlistId();
    this.api.delete(`playlists/${pid}`).subscribe({
      next: () => {
        this.cancelDelete();
        void this.router.navigate(['/playlists']);
      },
      error: () => {
        this.cancelDelete();
      },
    });
  }
}
