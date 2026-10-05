import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ArtistLookupService } from '../../core/services/artist-lookup.service';
import { AuthService } from '../../core/services/auth.service';
import { ListenHistoryCacheService } from '../../core/services/listen-history-cache.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { ClipComposerComponent } from './clip-composer/clip-composer.component';
import { QueueSheetComponent } from './queue-sheet/queue-sheet.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThumbComponent } from '../../shared/components/thumb/thumb.component';
import { formatDurationClock, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [
    ClipComposerComponent,
    CommonModule,
    IconComponent,
    QueueSheetComponent,
    ThumbComponent,
    TranslatePipe,
  ],
  template: `
    <audio
      #audioRef
      (timeupdate)="onTimeUpdate()"
      (loadedmetadata)="onLoadedMeta()"
      (ended)="onEnded()"
      (play)="onAudioPlay()"
    ></audio>

    @if (track(); as t) {
      <div class="player-shell" [class.sheet-expanded]="isExpanded()">
        <div
          class="player-scrim"
          role="button"
          tabindex="0"
          aria-label="closePlayer"
          [class.open]="isExpanded()"
          (click)="closeQueueSheet()"
          (keydown.escape)="closeQueueSheet()"
        ></div>
        <div class="player" [class.dragging]="isDragging()" [style.transform]="sheetTransform()">
          <div class="player-bar">
            <div class="zone left">
              <div class="thumb-wrap">
                <app-thumb [src]="t.thumbnailUrl" [alt]="t.title" [size]="72" />
              </div>
              <div class="meta">
                <div class="t-title">{{ t.title }}</div>
                <div class="t-artist-row">
                  <button
                    type="button"
                    class="t-artist"
                    (click)="artistLookup.openArtist(t.artist)"
                  >
                    {{ t.artist }}
                  </button>
                  <span class="t-dur">{{ formatTime(displayDur()) }}</span>
                </div>
              </div>
            </div>

            <div
              class="zone center"
              role="button"
              tabindex="0"
              aria-label="expandPlayer"
              (click)="onCenterZoneClick($event)"
              (keydown.enter)="toggleExpanded()"
            >
              <div
                class="drag-zone"
                (mousedown)="onDragStart($event)"
                aria-label="Drag to open queue"
              >
                <div class="drag-pill"></div>
              </div>
              <div class="btns">
                <button
                  type="button"
                  class="ctrl tap"
                  (click)="player.prev()"
                  aria-label="Previous"
                >
                  <svg class="ico-prev" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11 12V4l-6 4 6 4zM4 4v8h1V4H4z" />
                  </svg>
                </button>
                @if (playing()) {
                  <button type="button" class="ctrl main tap" (click)="pause()" aria-label="Pause">
                    <app-icon class="ico-play" name="pause" />
                  </button>
                } @else {
                  <button type="button" class="ctrl main tap" (click)="resume()" aria-label="Play">
                    <app-icon class="ico-play" name="play" [size]="24" />
                  </button>
                }
                <button type="button" class="ctrl tap" (click)="player.next()" aria-label="Next">
                  <svg class="ico-prev" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5 4v8l6-4-6-4zm6 0v8h1V4h-1z" />
                  </svg>
                </button>
              </div>
              <div class="progress-row">
                <span class="time">{{ formatTime(currentSec()) }}</span>
                <div
                  class="bar-wrap"
                  role="slider"
                  tabindex="0"
                  aria-label="seek"
                  aria-valuemin="0"
                  [attr.aria-valuenow]="currentSec()"
                  (click)="onBarClick($event)"
                  (keydown.arrowleft)="nudgeSeek(-5)"
                  (keydown.arrowright)="nudgeSeek(5)"
                >
                  <div class="bar-bg">
                    <div class="bar-fill" [style.width.%]="progress()"></div>
                    <div class="bar-knob" [style.left.%]="progress()"></div>
                  </div>
                </div>
                <span class="time">{{ formatTime(totalSec()) }}</span>
              </div>
            </div>

            <div class="zone right">
              @if (!isClipTrack()) {
                <button
                  type="button"
                  class="clip-btn tap"
                  (click)="openClip()"
                  aria-label="Create clip"
                >
                  <svg
                    class="ico-clip"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <line x1="20" y1="4" x2="8.12" y2="15.88" />
                    <line x1="20" y1="20" x2="8.12" y2="8.12" />
                  </svg>
                </button>
              }
            </div>
          </div>

          <app-queue-sheet [currentTrackId]="t.trackId" [playing]="playing()" />
        </div>
      </div>
    }

    @if (clipOpen() && track(); as t) {
      <app-clip-composer
        [track]="t"
        [maxSec]="clipMaxSec()"
        [previewPlaying]="clipPreviewPlaying()"
        (closed)="closeClip()"
        (preview)="previewClip($event)"
      />
    }
  `,
  styleUrl: './player.component.css',
})
export class PlayerComponent {
  readonly player = inject(PlayerService);
  private readonly api = inject(ApiService);
  readonly artistLookup = inject(ArtistLookupService);
  private readonly auth = inject(AuthService);
  private readonly listenHistoryCache = inject(ListenHistoryCacheService);
  private readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);

  readonly audioRef = viewChild<ElementRef<HTMLAudioElement>>('audioRef');

  readonly track = toSignal(this.player.currentTrack$, { initialValue: null });
  readonly playing = toSignal(this.player.isPlaying$, { initialValue: false });

  readonly progress = signal(0);
  readonly currentSec = signal(0);
  readonly totalSec = signal(0);
  readonly isExpanded = signal(false);
  readonly isDragging = signal(false);
  readonly dragOffset = signal(0);
  readonly viewportHeight = signal(typeof window !== 'undefined' ? window.innerHeight : 1080);

  private clipEnforceTimer: ReturnType<typeof setInterval> | null = null;
  private pendingClipStartTime: number | null = null;

  readonly sheetTransform = computed(() => {
    const hiddenOffset = Math.max(0, this.viewportHeight() - 112);
    const base = this.isExpanded() ? 0 : hiddenOffset;
    const pos = Math.max(0, Math.min(hiddenOffset, base + this.dragOffset()));
    return `translateY(${pos}px)`;
  });

  readonly isClipTrack = computed(() => {
    const t = this.track();
    return t?.trackId.startsWith('clip:') ?? false;
  });

  readonly displayDur = computed(() => {
    const t = this.track();
    if (!t) return 0;
    const fromTrack = normalizeDurationSeconds(t.duration);
    const fromStream = this.totalSec();
    if (fromStream > 0) return fromStream;
    if (fromTrack != null) return fromTrack;
    return 0;
  });

  readonly clipOpen = signal(false);
  /** Last seekable second of the current track; passed to the clip composer. */
  readonly clipMaxSec = signal(0);
  readonly clipPreviewPlaying = signal(false);
  /** Non-null while previewing a clip excerpt; bounds the previewed range. */
  readonly previewWindow = signal<{ start: number; end: number } | null>(null);

  private historyLoggedFor: string | null = null;
  private dragStartY = 0;
  private dragStartExpanded = false;
  private suppressToggleUntil = 0;

  constructor() {
    effect(() => {
      const t = this.track();
      const ref = this.audioRef();
      this.historyLoggedFor = null;
      if (this.clipEnforceTimer) {
        clearInterval(this.clipEnforceTimer);
        this.clipEnforceTimer = null;
      }
      if (!ref) {
        return;
      }
      const el = ref.nativeElement;
      this.player.setProgressPercent(0);
      this.progress.set(0);
      this.currentSec.set(0);
      const isClip =
        t?.trackId.startsWith('clip:') &&
        typeof t.startTime === 'number' &&
        typeof t.endTime === 'number';
      this.totalSec.set(
        t && isClip ? t.endTime! - t.startTime! : (normalizeDurationSeconds(t?.duration) ?? 0),
      );
      el.pause();
      el.src = '';
      el.oncanplay = null;
      if (!t) {
        this.totalSec.set(0);
        return;
      }
      const token = this.auth.getToken();
      if (!token) {
        this.player.pause();
        return;
      }
      const proxyUrl = isClip
        ? `/api/clips/${encodeURIComponent(t.trackId.slice(5))}/proxy-stream`
        : `/api/tracks/${encodeURIComponent(t.trackId)}/proxy-stream?access_token=${encodeURIComponent(token)}`;
      el.src = proxyUrl;
      el.load();
      if (isClip && t && typeof t.startTime === 'number') {
        this.pendingClipStartTime = t.startTime;
        el.currentTime = t.startTime;
      }

      const onEnd = () => {
        if (isClip) {
          el.currentTime = t!.startTime!;
          if (this.player.isPlaying$.value) {
            void el.play().catch(() => {});
          }
        } else {
          this.player.next();
        }
      };

      el.onloadedmetadata = null;
      el.oncanplay = null;
      el.onended = onEnd;

      if (isClip && t) {
        this.clipEnforceTimer = setInterval(() => {
          if (!el.paused && !el.ended && t) {
            if (el.currentTime >= t.endTime!) {
              el.pause();
              if (this.player.isPlaying$.value) {
                this.player.next();
              }
            } else if (el.currentTime < t.startTime! || el.currentTime > t.endTime!) {
              el.currentTime = t.startTime!;
            }
          }
        }, 200);
      }

      el.onerror = () => this.handlePlaybackError(t);
    });

    effect(() => {
      const p = this.playing();
      const ref = this.audioRef();
      if (!ref?.nativeElement.src) {
        return;
      }
      const el = ref.nativeElement;
      const t = this.track();
      if (p) {
        const isClip = t?.trackId.startsWith('clip:') && typeof t.startTime === 'number';
        if (isClip && this.pendingClipStartTime !== null) {
          el.volume = 0;
          setTimeout(() => {
            el.volume = 1;
          }, 900);
        }
        if (this.pendingClipStartTime !== null) {
          el.currentTime = this.pendingClipStartTime;
          this.pendingClipStartTime = null;
        }
        void el.play().catch(() => this.player.pause());
      } else {
        el.pause();
      }
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        if (this.isExpanded()) {
          this.closeQueueSheet();
        }
      });
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(ev: KeyboardEvent): void {
    if (ev.defaultPrevented) return;
    if (ev.repeat) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;

    const isSpace = ev.code === 'Space' || ev.key === ' ';
    if (!isSpace) return;

    const target = ev.target as
      (EventTarget & { tagName?: string; isContentEditable?: boolean }) | null;
    const tag = target?.tagName?.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }

    if (!this.track()) return;

    ev.preventDefault();
    if (this.playing()) {
      this.pause();
    } else {
      this.resume();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.viewportHeight.set(window.innerHeight);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMousemove(ev: MouseEvent): void {
    if (!this.isDragging()) {
      return;
    }
    const hiddenOffset = Math.max(0, this.viewportHeight() - 112);
    const delta = ev.clientY - this.dragStartY;
    const base = this.dragStartExpanded ? 0 : hiddenOffset;
    const next = Math.max(0, Math.min(hiddenOffset, base + delta));
    this.dragOffset.set(next - base);
  }

  @HostListener('window:mouseup')
  onWindowMouseup(): void {
    if (!this.isDragging()) {
      return;
    }
    const hiddenOffset = Math.max(0, this.viewportHeight() - 112);
    const base = this.dragStartExpanded ? 0 : hiddenOffset;
    const absolutePos = Math.max(0, Math.min(hiddenOffset, base + this.dragOffset()));
    this.isExpanded.set(absolutePos < hiddenOffset / 2);
    this.isDragging.set(false);
    this.dragOffset.set(0);
    this.suppressToggleUntil = Date.now() + 140;
  }

  onDragStart(ev: MouseEvent): void {
    if (ev.button !== 0) {
      return;
    }
    ev.preventDefault();
    this.dragStartY = ev.clientY;
    this.dragStartExpanded = this.isExpanded();
    this.isDragging.set(true);
    this.dragOffset.set(0);
  }

  onCenterZoneClick(ev: MouseEvent): void {
    if (Date.now() < this.suppressToggleUntil) {
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target?.closest('button, .bar-wrap, .bar-bg, .bar-fill, .bar-knob')) {
      return;
    }
    this.isExpanded.update((v) => !v);
  }

  /** Keyboard equivalent of tapping the centre zone to expand/collapse the player. */
  toggleExpanded(): void {
    this.isExpanded.update((v) => !v);
  }

  closeQueueSheet(): void {
    this.isExpanded.set(false);
    this.isDragging.set(false);
    this.dragOffset.set(0);
  }

  onTimeUpdate(): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    if (!el.duration || !isFinite(el.duration)) return;
    const t = this.track();
    const isClip =
      t?.trackId.startsWith('clip:') &&
      typeof t.startTime === 'number' &&
      typeof t.endTime === 'number';

    let pct: number;
    let curSec: number;
    let totSec: number;

    if (isClip && t && typeof t.startTime === 'number' && typeof t.endTime === 'number') {
      const clipDur = t.endTime - t.startTime;
      curSec = el.currentTime - t.startTime;
      curSec = Math.max(0, Math.min(clipDur, curSec));
      totSec = clipDur;
      pct = clipDur > 0 ? (curSec / clipDur) * 100 : 0;
    } else {
      pct = (el.currentTime / el.duration) * 100;
      curSec = el.currentTime;
      totSec = el.duration;
    }

    this.player.setProgressPercent(pct);
    this.progress.set(pct);
    this.currentSec.set(curSec);
    this.totalSec.set(totSec);

    const preview = this.previewWindow();
    if (preview && this.clipPreviewPlaying() && el.currentTime >= preview.end) {
      el.pause();
      this.clipPreviewPlaying.set(false);
      el.currentTime = preview.start;
    }
  }

  onLoadedMeta(): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    const t = this.track();
    const isClip =
      t?.trackId.startsWith('clip:') &&
      typeof t.startTime === 'number' &&
      typeof t.endTime === 'number';
    if (t && isClip) {
      this.totalSec.set(t.endTime! - t.startTime!);
    } else if (isFinite(el.duration) && el.duration > 0) {
      this.totalSec.set(el.duration);
    }
  }

  onEnded(): void {
    this.player.next();
  }

  /**
   * A track that will not play (region lock, removed video, expired URL) used
   * to leave the player paused with no feedback, so it looked stuck forever.
   * Report it and move on to the next queue item; if there is nothing left,
   * just stop.
   */
  private handlePlaybackError(track: PlayerTrack | null): void {
    const el = this.audioRef()?.nativeElement;
    el?.pause();

    const hasNext = this.player.hasNext();

    if (track && !track.trackId.startsWith('clip:')) {
      this.toast.show(this.settings.t('trackUnavailable'));
    }

    if (hasNext) {
      this.player.next();
      return;
    }

    this.player.pause();
  }

  onAudioPlay(): void {
    const t = this.track();
    if (!t || this.historyLoggedFor === t.trackId) return;
    if (t.trackId.startsWith('clip:')) return;
    this.historyLoggedFor = t.trackId;

    if (!t.duration && t.trackId && !t.trackId.startsWith('clip:')) {
      this.api.get<{ duration: number }>(`tracks/${t.trackId}/meta`).subscribe({
        next: (meta) => {
          if (meta?.duration) {
            const updated = { ...t, duration: meta.duration };
            this.player.currentTrack$.next(updated);
          }
        },
        error: () => {},
      });
    }

    this.listenHistoryCache.record({
      trackId: t.trackId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.thumbnailUrl ?? null,
      duration: t.duration ?? null,
    });
    this.api
      .post('history', {
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        thumbnailUrl: t.thumbnailUrl ?? undefined,
        duration: t.duration ?? undefined,
      })
      .subscribe({ error: () => {} });
  }

  pause(): void {
    this.player.pause();
  }

  resume(): void {
    const t = this.track();
    const ref = this.audioRef();
    if (
      ref &&
      t?.trackId.startsWith('clip:') &&
      typeof t.startTime === 'number' &&
      typeof t.endTime === 'number'
    ) {
      const el = ref.nativeElement;
      if (el.ended || el.currentTime >= t.endTime!) {
        el.currentTime = t.startTime!;
      }
    }
    this.player.resume();
  }

  /** Keyboard equivalent of dragging the progress bar: arrow keys nudge the playhead. */
  nudgeSeek(deltaSec: number): void {
    const ref = this.audioRef();
    const el = ref?.nativeElement as HTMLAudioElement | undefined;
    if (!el || !isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + deltaSec));
  }

  onBarClick(ev: MouseEvent): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    if (!el.duration || !isFinite(el.duration)) return;
    const bar = (ev.currentTarget as HTMLElement).querySelector('.bar-bg');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, x / rect.width));
    const t = this.track();
    const isClip =
      t?.trackId.startsWith('clip:') &&
      typeof t.startTime === 'number' &&
      typeof t.endTime === 'number';
    if (t && isClip) {
      const start = t.startTime!;
      const end = t.endTime!;
      el.currentTime = start + frac * (end - start);
    } else {
      el.currentTime = frac * el.duration;
    }
  }

  formatTime(sec: number): string {
    return formatDurationClock(sec);
  }

  openClip(): void {
    if (this.isClipTrack()) {
      return;
    }
    const t = this.track();
    if (!t) {
      return;
    }
    const fallback = normalizeDurationSeconds(t.duration) ?? 180;
    this.clipMaxSec.set(Math.max(1, Math.floor(this.totalSec() || fallback)));
    this.clipOpen.set(true);
  }

  closeClip(): void {
    this.stopClipPreview();
    this.previewWindow.set(null);
    this.clipOpen.set(false);
  }

  /** Toggles preview of the composer's selected range on the shared <audio>. */
  previewClip(range: { start: number; end: number }): void {
    const ref = this.audioRef();
    if (!ref) {
      return;
    }
    const el = ref.nativeElement;
    if (this.clipPreviewPlaying()) {
      this.stopClipPreview();
      return;
    }
    const max = this.clipMaxSec();
    const start = Math.max(0, Math.min(max - 1, Math.floor(range.start)));
    const end = Math.max(start + 1, Math.min(max, Math.floor(range.end)));
    this.previewWindow.set({ start, end });
    el.currentTime = start;
    this.clipPreviewPlaying.set(true);
    void el.play().catch(() => this.stopClipPreview());
  }

  private stopClipPreview(): void {
    this.audioRef()?.nativeElement.pause();
    this.clipPreviewPlaying.set(false);
  }
}
