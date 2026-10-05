import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { ToastService } from '../../../core/services/toast.service';
import type { PlayerTrack } from '../../../core/services/player.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../../shared/pipes/t.pipe';
import {
  buildPlaylistPreview,
  type PlaylistRow,
} from '../../../shared/utils/playlist-preview.util';
import { formatDurationClock } from '../../../shared/utils/duration.util';

/**
 * Modal for cutting a short excerpt ("clip") out of the currently playing
 * track and publishing it as a shareable /clip/<code> link, optionally adding
 * the result to a playlist.
 *
 * The component is mounted only while the sheet is open, so all form state
 * starts from defaults on every open without any manual reset. Audio preview
 * is delegated to the player through the `preview` output because the preview
 * uses the player's single <audio> element.
 */
@Component({
  selector: 'app-clip-composer',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, RouterLink, TranslatePipe],
  template: `
    <app-modal [title]="'createClip' | t" [isOpen]="true" (closed)="closed.emit()">
      <p class="clip-preview">
        {{ formatTime(startSec()) }} — {{ formatTime(endSec()) }} · {{ formatTime(lengthSec()) }}
      </p>
      <label class="rng-lab">
        <span>{{ 'clipName' | t }}</span>
        <input
          type="text"
          class="clip-name-input"
          [ngModel]="name()"
          (ngModelChange)="name.set(($event ?? '').toString())"
          [placeholder]="'clipNamePlaceholder' | t"
        />
      </label>
      <label class="rng-lab">
        <span>{{ 'startSeconds' | t }}</span>
        <input
          type="range"
          [min]="0"
          [max]="maxSec()"
          [step]="1"
          [ngModel]="startSec()"
          (ngModelChange)="onStartChange($event)"
        />
      </label>
      <label class="rng-lab">
        <span>{{ 'endSeconds' | t }}</span>
        <input
          type="range"
          [min]="0"
          [max]="maxSec()"
          [step]="1"
          [ngModel]="endSec()"
          (ngModelChange)="onEndChange($event)"
        />
      </label>
      @if (error()) {
        <p class="error-text err">{{ error() }}</p>
      }
      @if (result(); as cr) {
        <p class="ok">{{ 'clipReady' | t }}</p>
        <a class="link" [routerLink]="['/clip', cr]">Open /clip/{{ cr }}</a>
        <button type="button" class="copy tap" (click)="copyLink(cr)">
          {{ 'copyLink' | t }}
        </button>
        <div class="pl-create">
          <input
            type="text"
            class="pl-inp"
            [(ngModel)]="newPlaylistName"
            [placeholder]="'newPlaylistNamePlaceholder' | t"
            (keydown.enter)="createPlaylistAndAddClip()"
          />
          <button
            type="button"
            class="pl-create-btn tap"
            [disabled]="creatingPlaylist() || !newPlaylistName.trim()"
            (click)="createPlaylistAndAddClip()"
          >
            {{ 'create' | t }}
          </button>
        </div>
        @if (loadingLists()) {
          <p class="ok">{{ 'loading' | t }}</p>
        } @else if (playlists().length > 0) {
          <div class="pl-list" role="list">
            @for (p of playlists(); track p.id) {
              <button type="button" class="pl-row tap" (click)="addToPlaylist(p.id)">
                <div class="pl-prev" aria-hidden="true">
                  @if (p.preview.kind === 'mosaic') {
                    <div class="pl-mosaic">
                      @for (u of p.preview.urls; track u) {
                        <img class="pl-mosaic-img" [src]="u" alt="" loading="lazy" />
                      }
                    </div>
                  } @else {
                    @if (p.preview.url) {
                      <img class="pl-cover" [src]="p.preview.url" alt="" loading="lazy" />
                    } @else {
                      <div class="pl-cover ph" aria-hidden="true"></div>
                    }
                  }
                </div>
                <div class="pl-txt">
                  <div class="pl-name">{{ p.name }}</div>
                  <div class="pl-meta">{{ p.trackCount }} {{ 'tracksSuffix' | t }}</div>
                </div>
                @if (addedPlaylistId() === p.id) {
                  <span class="pl-added">{{ 'clipAddedToPlaylist' | t }}</span>
                }
              </button>
            }
          </div>
        }
      } @else {
        <button
          type="button"
          class="copy tap"
          [disabled]="saving()"
          (click)="preview.emit({ start: startSec(), end: endSec() })"
        >
          {{ previewPlaying() ? ('pause' | t) : ('previewClip' | t) }}
        </button>
        <button type="button" class="create tap" [disabled]="saving()" (click)="create()">
          {{ 'create' | t }}
        </button>
      }
    </app-modal>
  `,
  styleUrl: './clip-composer.component.css',
})
export class ClipComposerComponent {
  private readonly api = inject(ApiService);
  private readonly settings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);

  readonly track = input.required<PlayerTrack>();
  /** Last seekable second of the source track; bounds both sliders. */
  readonly maxSec = input.required<number>();
  readonly previewPlaying = input(false);

  readonly closed = output<void>();
  /** Ask the player to start/pause previewing the selected range. */
  readonly preview = output<{ start: number; end: number }>();

  readonly startSec = signal(0);
  readonly endSec = signal(30);
  readonly name = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly result = signal<string | null>(null);

  readonly loadingLists = signal(false);
  readonly creatingPlaylist = signal(false);
  readonly playlists = signal<PlaylistRow[]>([]);
  readonly addedPlaylistId = signal<number | null>(null);
  newPlaylistName = '';

  readonly lengthSec = computed(() => Math.max(0, this.endSec() - this.startSec()));

  constructor() {
    this.loadPlaylists();
  }

  formatTime(sec: number): string {
    return formatDurationClock(sec);
  }

  onStartChange(v: number): void {
    const max = this.maxSec();
    const start = Math.max(0, Math.min(max, Math.floor(v)));
    this.startSec.set(start);
    if (start >= this.endSec()) {
      this.endSec.set(Math.min(max, start + 1));
    }
  }

  onEndChange(v: number): void {
    const max = this.maxSec();
    const end = Math.max(0, Math.min(max, Math.floor(v)));
    this.endSec.set(end);
    if (end <= this.startSec()) {
      this.startSec.set(Math.max(0, end - 1));
    }
  }

  create(): void {
    const t = this.track();
    const start = this.startSec();
    const end = this.endSec();
    const clipName = this.name().trim();
    if (end <= start) {
      this.error.set(this.settings.t('endMustBeGreater'));
      return;
    }
    if (!clipName) {
      this.error.set(this.settings.t('clipNameRequired'));
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.api
      .post<{ shortCode: string }>('clips', {
        trackId: t.trackId,
        title: t.title,
        clipName,
        artist: t.artist,
        thumbnailUrl: '/clip-cover.svg',
        startTime: start,
        endTime: end,
      })
      .subscribe({
        next: (res) => {
          this.result.set(res.shortCode);
          this.saving.set(false);
        },
        error: () => {
          this.error.set(this.settings.t('failedCreateClip'));
          this.saving.set(false);
        },
      });
  }

  copyLink(code: string): void {
    void navigator.clipboard.writeText(`${window.location.origin}/clip/${code}`);
  }

  addToPlaylist(playlistId: number, done?: () => void): void {
    const t = this.track();
    const code = this.result();
    if (!code) {
      done?.();
      return;
    }
    this.api
      .post(`playlists/${playlistId}/tracks`, {
        trackId: `clip:${code}`,
        title: this.name().trim(),
        artist: t.artist,
        thumbnailUrl: '/clip-cover.svg',
        duration: Math.max(1, this.lengthSec()),
        isClip: true,
      })
      .subscribe({
        next: () => {
          this.addedPlaylistId.set(playlistId);
          this.loadPlaylists();
          done?.();
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.toast.show(this.settings.t('clipNameDuplicateInPlaylist'));
          }
          done?.();
        },
      });
  }

  createPlaylistAndAddClip(): void {
    const name = this.newPlaylistName.trim();
    if (!name || this.creatingPlaylist()) {
      return;
    }
    if (name.length > 25) {
      this.toast.show(this.settings.t('playlistNameTooLong'));
      return;
    }
    const normalized = name.toLowerCase();
    if (this.playlists().some((p) => p.name.trim().toLowerCase() === normalized)) {
      this.toast.show(this.settings.t('playlistAlreadyExists'));
      return;
    }
    this.creatingPlaylist.set(true);
    this.api.post<{ id: number }>('playlists', { name }).subscribe({
      next: (res) => {
        if (!res?.id) {
          this.creatingPlaylist.set(false);
          return;
        }
        this.addToPlaylist(res.id, () => {
          this.newPlaylistName = '';
          this.creatingPlaylist.set(false);
        });
      },
      error: () => this.creatingPlaylist.set(false),
    });
  }

  private loadPlaylists(): void {
    this.loadingLists.set(true);
    this.api.get<{ id: number; name: string }[]>('playlists').subscribe({
      next: (list) => {
        if (list.length === 0) {
          this.playlists.set([]);
          this.loadingLists.set(false);
          return;
        }
        forkJoin(
          list.map((p) =>
            this.api.get<{ thumbnailUrl: string | null }[]>(`playlists/${p.id}/tracks`).pipe(
              map((tracks) => ({
                id: p.id,
                name: p.name,
                trackCount: tracks.length,
                preview: buildPlaylistPreview(tracks),
              })),
              catchError(() =>
                of({
                  id: p.id,
                  name: p.name,
                  trackCount: 0,
                  preview: { kind: 'single' as const, url: null },
                }),
              ),
            ),
          ),
        ).subscribe({
          next: (rows) => {
            this.playlists.set(rows);
            this.loadingLists.set(false);
          },
          error: () => this.loadingLists.set(false),
        });
      },
      error: () => this.loadingLists.set(false),
    });
  }
}
