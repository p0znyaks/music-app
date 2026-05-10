import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
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
  imports: [CommonModule, RouterLink, TranslatePipe],
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
            @if (c.thumbnailUrl) {
              <img [src]="c.thumbnailUrl" [alt]="c.title" width="200" height="200" />
            } @else {
              <div class="cover-ph"></div>
            }
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              } @else {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
            <div class="progress-wrap" (click)="onBarClick($event)">
              <div class="progress-bg">
                <div class="progress-fill" [style.width.%]="progressPercent()"></div>
              </div>
            </div>
            <span class="time-display">{{ formatTime(clipTimeElapsed()) }} / {{ formatTime(clipDuration()) }}</span>
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
  styles: `
    :host {
      display: block;
    }
    .page {
      min-height: 100vh;
      background: var(--bg);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      position: relative;
    }
    .page.not-found {
      gap: 1rem;
    }
    .nf-title {
      font-size: 4rem;
      font-weight: 800;
      color: var(--accent);
      margin: 0;
    }
    .nf-text {
      font-size: 1.25rem;
      color: var(--accent-dim);
      margin: 0;
    }
    .nf-link {
      color: var(--accent);
      text-decoration: underline;
      font-size: 1rem;
    }
    .loader {
      color: var(--accent-dim);
    }
    .clip-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 360px;
    }
    .cover-wrap {
      width: 200px;
      height: 200px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      margin-bottom: 1.5rem;
    }
    .cover-wrap img {
      width: 200px;
      height: 200px;
      object-fit: cover;
      display: block;
    }
    .cover-ph {
      width: 200px;
      height: 200px;
      background: var(--bg-hover);
    }
    .track-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--accent);
      margin: 0 0 0.25rem 0;
    }
    .track-artist {
      font-size: 1rem;
      color: var(--accent-dim);
      margin: 0 0 1.5rem 0;
    }
    .player-wrap {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .play-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: var(--accent);
      color: var(--bg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.12s ease;
    }
    .play-btn.tap:active {
      transform: scale(0.94);
    }
    .progress-wrap {
      width: 100%;
      cursor: pointer;
      padding: 8px 0;
    }
    .progress-bg {
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.05s linear;
    }
    .time-display {
      font-size: 12px;
      color: var(--accent-dim);
    }
    .footer {
      position: absolute;
      bottom: 1.5rem;
      font-size: 0.8rem;
      color: var(--accent-dim);
      margin: 0;
      text-align: center;
    }
  `,
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
