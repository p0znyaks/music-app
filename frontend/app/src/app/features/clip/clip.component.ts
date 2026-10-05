import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThumbComponent } from '../../shared/components/thumb/thumb.component';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

interface ClipData {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  startTime: number;
  endTime: number;
}

@Component({
  selector: 'app-clip',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, ThumbComponent, IconComponent],
  template: `
    @if (notFound()) {
      <div class="page not-found">
        <h1 class="nf-title">404</h1>
        <p class="nf-text">{{ 'clipNotFound' | t }}</p>
        <a routerLink="/" class="nf-link">{{ 'goHome' | t }}</a>
      </div>
    } @else if (clip(); as c) {
      <div class="page">
        <div class="clip-content">
          <div class="cover-wrap">
            <app-thumb [src]="c.thumbnailUrl" [alt]="c.title" [size]="200" />
          </div>
          <h2 class="track-title">{{ c.title }}</h2>
          <p class="track-artist">{{ c.artist }}</p>

          <div class="player-wrap">
            <button
              type="button"
              class="play-btn tap"
              (click)="togglePlay()"
              [attr.aria-label]="playing() ? 'Pause' : 'Play'"
            >
              @if (playing()) {
                <app-icon name="pause" [size]="24" />
              } @else {
                <app-icon name="play" [size]="24" />
              }
            </button>
            <div
              class="progress-wrap"
              role="slider"
              tabindex="0"
              aria-label="seek"
              aria-valuemin="0"
              [attr.aria-valuenow]="progressPercent()"
              (click)="onBarClick($event)"
              (keydown.arrowleft)="nudgeSeek(-5)"
              (keydown.arrowright)="nudgeSeek(5)"
            >
              <div class="progress-bg">
                <div class="progress-fill" [style.width.%]="progressPercent()"></div>
              </div>
            </div>
            <span class="time-display"
              >{{ formatTime(clipTimeElapsed()) }} / {{ formatTime(clipDuration()) }}</span
            >
          </div>
          <audio #audioRef preload="metadata"></audio>
        </div>
        <p class="footer">{{ 'sharedViaMuze' | t }}</p>
      </div>
    } @else if (loading()) {
      <div class="page">
        <div class="loader">{{ 'loading' | t }}</div>
      </div>
    }
  `,
  styleUrl: './clip.component.css',
})
export class ClipComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly shortCode = this.route.snapshot.paramMap.get('code') ?? '';

  readonly audioRef = viewChild<ElementRef<HTMLAudioElement>>('audioRef');

  readonly clip = signal<ClipData | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly playing = signal(false);
  readonly currentTime = signal(0);

  private audioInitializedFor: string | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;

  readonly clipDuration = computed(() => {
    const c = this.clip();
    return c ? c.endTime - c.startTime : 0;
  });

  readonly clipTimeElapsed = computed(() => {
    const c = this.clip();
    if (!c) return 0;
    return Math.max(0, this.currentTime() - c.startTime);
  });

  readonly progressPercent = computed(() => {
    const dur = this.clipDuration();
    if (dur <= 0) return 0;
    return Math.min(100, Math.max(0, (this.clipTimeElapsed() / dur) * 100));
  });

  constructor() {
    if (!this.shortCode) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.api.get<ClipData>(`clips/${this.shortCode}`).subscribe({
      next: (data) => {
        this.clip.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });

    effect((onCleanup) => {
      const c = this.clip();
      const ref = this.audioRef();
      if (!c || !ref) return;

      if (this.audioInitializedFor === c.trackId) return;
      this.audioInitializedFor = c.trackId;

      const el = ref.nativeElement;
      const proxyUrl = `/api/clips/${encodeURIComponent(this.shortCode)}/proxy-stream`;
      el.src = proxyUrl;

      const onTime = () => {
        this.currentTime.set(el.currentTime);
        if (el.currentTime >= c.endTime) {
          el.pause();
          this.playing.set(false);
          el.currentTime = c.startTime;
          this.currentTime.set(c.startTime);
        }
      };

      const onMeta = () => {
        el.currentTime = c.startTime;
        this.currentTime.set(c.startTime);
      };

      const onEnd = () => {
        this.playing.set(false);
        el.currentTime = c.startTime;
        this.currentTime.set(c.startTime);
      };

      const onCanPlay = () => {
        if (el.currentTime < c.startTime || el.currentTime > c.endTime) {
          el.currentTime = c.startTime;
          this.currentTime.set(c.startTime);
        }
      };

      el.addEventListener('timeupdate', onTime);
      el.addEventListener('loadedmetadata', onMeta);
      el.addEventListener('ended', onEnd);
      el.addEventListener('canplay', onCanPlay);
      el.load();

      // Fallback interval for browsers where timeupdate is sparse
      this.timerId = setInterval(() => {
        if (!el.paused && !el.ended) {
          this.currentTime.set(el.currentTime);
          if (el.currentTime >= c.endTime) {
            el.pause();
            this.playing.set(false);
            el.currentTime = c.startTime;
            this.currentTime.set(c.startTime);
          }
        }
      }, 200);

      onCleanup(() => {
        el.removeEventListener('timeupdate', onTime);
        el.removeEventListener('loadedmetadata', onMeta);
        el.removeEventListener('ended', onEnd);
        el.removeEventListener('canplay', onCanPlay);
        if (this.timerId) {
          clearInterval(this.timerId);
          this.timerId = null;
        }
      });
    });
  }

  togglePlay(): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    const c = this.clip();
    if (this.playing()) {
      el.pause();
      this.playing.set(false);
    } else {
      if (c && el.currentTime >= c.endTime) {
        el.currentTime = c.startTime;
        this.currentTime.set(c.startTime);
      }
      void el.play().catch(() => {});
      this.playing.set(true);
    }
  }

  /** Keyboard equivalent of dragging the clip progress bar. */
  nudgeSeek(deltaSec: number): void {
    const ref = this.audioRef();
    const c = this.clip();
    if (!ref || !c) return;
    const el = ref.nativeElement as HTMLAudioElement;
    const span = c.endTime - c.startTime;
    if (span <= 0) return;
    el.currentTime = Math.max(c.startTime, Math.min(c.endTime, el.currentTime + deltaSec));
  }

  onBarClick(ev: MouseEvent): void {
    const ref = this.audioRef();
    const c = this.clip();
    if (!ref || !c) return;
    const el = ref.nativeElement;
    const bar = (ev.currentTarget as HTMLElement).querySelector('.progress-bg');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    const duration = c.endTime - c.startTime;
    el.currentTime = c.startTime + frac * duration;
    this.currentTime.set(el.currentTime);
  }

  formatTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
