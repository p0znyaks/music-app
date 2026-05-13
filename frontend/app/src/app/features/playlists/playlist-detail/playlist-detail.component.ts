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
import { formatDurationCompact, normalizeDurationSeconds } from '../../../shared/utils/duration.util';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { TrackCardComponent } from '../../../shared/components/track-card/track-card.component';
import { TranslatePipe } from '../../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../../core/services/app-settings.service';

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TrackCardComponent, ModalComponent, TranslatePipe],
  template: `
    <div class="page">
      <div class="head">
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
        <h1>{{ title() }}</h1>
        @if (!isMix()) {
          <button type="button" class="del-btn tap" (click)="askDelete()">{{ 'deletePlaylist' | t }}</button>
        }
      </div>

      <div class="playlist-meta">
        <div class="meta-row">
          <span class="meta-pill">{{ trackCountLabel() }}</span>
          <span class="meta-sep">·</span>
          <span class="meta-pill">{{ totalDurationLabel() }}</span>
        </div>
        <div class="action-row">
          <button type="button" class="action-btn tap" [disabled]="tracks().length === 0" (click)="playAll()">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2l10 6-10 6V2z"/></svg>
            <span>{{ 'playAll' | t }}</span>
          </button>
          <button type="button" class="action-btn alt tap" [disabled]="tracks().length === 0" (click)="shuffleAll()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
            <span>{{ 'shuffle' | t }}</span>
          </button>
        </div>
      </div>

      <div class="list">
        @for (row of tracks(); track row.trackId + '-' + row.id) {
          <div class="row">
            <app-track-card class="grow" [track]="toAppTrack(row)" [showDuration]="true" [inPlaylist]="true" [allowTagging]="!isMix()" [queue]="queueTracks()" />
            @if (!isMix()) {
              <button
                type="button"
                class="rm list-rm tap"
                (click)="removeTrack(row.trackId)"
                [title]="'remove' | t"
                [attr.aria-label]="'remove' | t"
              >
                🗑️
              </button>
            }
          </div>
        }
      </div>
    </div>

    @if (confirming()) {
      <div class="modal-backdrop" (click)="cancelDelete()">
        <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="modal-title">{{ 'deletePlaylistTitle' | t }}</div>
          <div class="modal-text">{{ 'deletePlaylistConfirm' | t }}</div>
          <div class="modal-actions">
            <button type="button" class="btn ghost tap" (click)="cancelDelete()">{{ 'no' | t }}</button>
            <button type="button" class="btn danger tap" (click)="confirmDelete()">{{ 'yes' | t }}</button>
          </div>
        </div>
      </div>
    }

    <app-modal [title]="'trackHasTags' | t" [isOpen]="confirmOpen()" (closed)="confirmOpen.set(false)">
      <p>{{ 'removeTrackWithTagsConfirm' | t }}</p>
      <div class="confirm-row">
        <button type="button" class="rm ghost" (click)="confirmOpen.set(false)">{{ 'no' | t }}</button>
        <button type="button" class="rm danger" (click)="confirmRemove()">{{ 'yes' | t }}</button>
      </div>
    </app-modal>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      max-width: 720px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      flex: 1;
      font-size: 1.5rem;
      min-width: 0;
    }
    .playlist-meta {
      margin-bottom: 1.1rem;
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
    .back {
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent-dim);
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      transition:
        background 0.2s ease,
        border-color 0.2s ease,
        color 0.2s ease,
        transform 0.12s ease;
    }
    .back:hover {
      background: var(--bg-hover);
      border-color: var(--accent-dim);
      color: var(--accent);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .row {
      display: flex;
      align-items: flex-start;
      gap: 0.25rem;
    }
    .grow {
      flex: 1;
      min-width: 0;
    }
    .rm {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border: none;
      background: transparent;
      border-radius: 999px;
      cursor: pointer;
      display: grid;
      place-items: center;
      color: var(--accent-dim);
      transition:
        color 0.2s ease,
        background 0.2s ease,
        transform 0.12s ease;
    }
    .rm:hover {
      color: var(--accent);
      background: var(--bg-hover);
    }
    .rm.tap:active {
      transform: scale(0.92);
    }
    .list-rm {
      margin-top: 14px;
    }
    .rm.ghost {
      width: auto;
      height: auto;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--accent-dim);
    }
    .rm.danger {
      width: auto;
      height: auto;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--accent);
      color: var(--bg);
    }
    .confirm-row {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 12px;
    }

    .del-btn {
      padding: 0.55rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--text);
      cursor: pointer;
      font-size: 0.9rem;
      transition:
        background 0.2s ease,
        border-color 0.2s ease,
        transform 0.12s ease;
      flex-shrink: 0;
    }
    .del-btn:hover {
      background: var(--bg-hover);
      border-color: var(--accent-dim);
    }
    .del-btn.tap:active {
      transform: scale(0.96);
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      z-index: 1000;
    }
    .modal {
      width: min(520px, 100%);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    }
    .modal-title {
      font-size: 1.1rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
    }
    .modal-text {
      color: var(--accent-dim);
      font-size: 0.9rem;
      line-height: 1.35;
      margin-bottom: 0.65rem;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .btn {
      padding: 0.5rem 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 0.85rem;
      transition:
        background 0.2s ease,
        border-color 0.2s ease,
        color 0.2s ease,
        transform 0.12s ease;
    }
    .btn.ghost {
      background: transparent;
      color: var(--accent-dim);
    }
    .btn.ghost:hover {
      background: var(--bg-hover);
      color: var(--accent);
    }
    .btn.danger {
      background: #ef4444;
      border-color: #ef4444;
      color: #0b0b0c;
      font-weight: 700;
    }
    .btn.danger:hover {
      background: #dc2626;
      border-color: #dc2626;
    }
    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `,
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
  readonly queueTracks = computed<PlayerTrack[]>(() => this.tracks().map((row) => this.toPlayerTrack(row)));
  readonly trackCountLabel = computed(() => `${this.tracks().length} ${this.settings.t('tracksSuffix')}`);
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.tracks().reduce((sum, row) => sum + (normalizeDurationSeconds(row.duration) ?? 0), 0);
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
      this.api.get<{ id: number; trackId: string; title: string; artist: string; thumbnailUrl: string | null; duration: number | null; startTime?: number | null; endTime?: number | null; addedAt?: string | null }[]>(`reco/mixes/${encodeURIComponent(mid)}`).subscribe({
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
    this.api.get<{ id: number; trackId: string; title: string; artist: string; thumbnailUrl: string | null; duration: number | null; startTime?: number | null; endTime?: number | null; addedAt?: string | null }[]>(`playlists/${pid}/tracks`).subscribe({
      next: (list) => {
        this.tracks.set(list);
        if (this.title() === this.playlistBaseTitle() && !history.state?.name) {
          this.title.set(`${this.settings.t('playlists')} #${pid}`);
        }
        const missing = list.filter((t) => t.duration == null).slice(0, 10);
        if (missing.length > 0) {
          forkJoin(
            missing.map((t) =>
              this.api.get<{ duration: number }>(`tracks/${encodeURIComponent(t.trackId)}/metadata`).pipe(
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

  private toPlayerTrack(row: {
    trackId: string;
    title: string;
    artist: string;
    thumbnailUrl: string | null;
    duration: number | null;
    startTime?: number | null;
    endTime?: number | null;
  }): PlayerTrack {
    return {
      trackId: row.trackId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl ?? undefined,
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
          const payload = this.parseErrorPayload(err);
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

  private parseErrorPayload(err: HttpErrorResponse): any {
    const e = err.error;
    if (e && typeof e === 'object') {
      return e;
    }
    if (typeof e === 'string') {
      try {
        return JSON.parse(e);
      } catch {
        return null;
      }
    }
    return null;
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

  cancelDelete(): void {
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
