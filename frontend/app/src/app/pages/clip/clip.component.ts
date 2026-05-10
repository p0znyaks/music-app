import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { ApiService } from '../../core/services/api.service';

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
  imports: [TranslatePipe],
  template: `
    <div class="page">
      @if (clip(); as c) {
        <div class="thumb-wrap">
          @if (c.thumbnailUrl) {
            <img [src]="c.thumbnailUrl" [alt]="c.title" />
          } @else {
            <div class="thumb-ph"></div>
          }
        </div>
        <h1>{{ c.title }}</h1>
        <p class="artist">{{ c.artist }}</p>
        <p class="time">{{ formatTime(c.startTime) }} — {{ formatTime(c.endTime) }}</p>
      } @else if (loading()) {
        <p class="hint">{{ 'loading' | t }}</p>
      } @else {
        <p class="hint">{{ 'clipNotFound' | t }}</p>
      }
    </div>
  `,
  styles: `
    .page {
      min-height: 100vh;
      padding: 2rem;
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .thumb-wrap {
      width: 200px;
      height: 200px;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 1.5rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .thumb-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .thumb-ph {
      width: 100%;
      height: 100%;
      background: var(--border);
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .artist {
      color: var(--accent-dim);
      margin-bottom: 0.5rem;
    }
    .time {
      color: var(--accent-dim);
      font-size: 0.9rem;
    }
    .hint {
      color: var(--accent-dim);
      font-size: 0.9rem;
    }
  `,
})
export class ClipComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  readonly clip = signal<ClipData | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.loadClip();
  }

  private loadClip(): void {
    this.api.get<ClipData>(`clips/${this.code}`).subscribe({
      next: (data) => {
        this.clip.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  formatTime(sec: number): string {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
