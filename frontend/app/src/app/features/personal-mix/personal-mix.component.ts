import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { ApiService } from '../../core/services/api.service';
import type { HomeRecoResponse } from '../home/home.model';

interface MixCard {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  previewThumbs: string[];
}

@Component({
  selector: 'app-personal-mix',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="page">
      <h1>{{ 'personalMix' | t }}</h1>
      @if (mixes().length > 0) {
        <div class="mix-grid">
          @for (mix of mixes(); track mix.id) {
            <a class="mix-card" [routerLink]="['/mixes', mix.id]" [state]="{ name: mix.title }">
              @if (mix.previewThumbs.length) {
                <div class="mix-collage tile-cover">
                  @for (thumb of mix.previewThumbs.slice(0, 4); track thumb) {
                    <img [src]="thumb" [alt]="mix.title" />
                  }
                </div>
              } @else if (mix.thumbnailUrl) {
                <img class="tile-cover" [src]="mix.thumbnailUrl" [alt]="mix.title" />
              } @else {
                <div class="tile-cover ph"></div>
              }
              <div class="mix-info">
                <div class="mix-title">{{ mix.title }}</div>
                <div class="mix-sub">{{ mix.subtitle }}</div>
              </div>
            </a>
          }
        </div>
      } @else {
        <div class="empty">
          <p>{{ 'personalMixEmpty' | t }}</p>
          <button type="button" class="gen-btn" [disabled]="generating()" (click)="generate()">
            {{ 'personalMixGenerate' | t }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .page {
      padding: 2rem 1.5rem 2rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    h1 {
      font-size: 2rem;
      margin: 0;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1.5rem;
      padding: 2rem 0;
    }
    .empty p {
      color: var(--accent-dim);
      font-size: 1.05rem;
      margin: 0;
    }
    .gen-btn {
      padding: 0.75rem 2rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--bg-card);
      color: var(--accent);
      font-size: 1rem;
      cursor: pointer;
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .gen-btn:hover:not(:disabled) {
      transform: translateY(-1px) scale(1.03);
      background: var(--bg-hover);
      border-color: var(--accent-dim);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .gen-btn:active:not(:disabled) {
      transform: scale(0.97);
    }
    .gen-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .mix-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
    }
    .mix-card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      text-decoration: none;
      color: inherit;
    }
    .mix-card:hover .tile-cover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      transform: translateY(-2px);
    }
    .tile-cover {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 12px;
      object-fit: cover;
      border: 1px solid var(--border);
      background: var(--bg-card);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .tile-cover.ph {
      background: linear-gradient(145deg, var(--border), var(--bg-hover));
    }
    .mix-collage {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
      overflow: hidden;
    }
    .mix-collage img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .mix-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .mix-title {
      font-weight: 600;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mix-sub {
      color: var(--accent-dim);
      font-size: 0.8rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class PersonalMixComponent {
  private readonly api = inject(ApiService);
  readonly generating = signal(false);
  readonly mixes = signal<MixCard[]>([]);
  private readonly STORAGE_KEY = 'personalMixMixes';

  constructor() {
    this.loadStored();
  }

  private loadStored(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as MixCard[];
        if (stored.length > 0) {
          this.mixes.set(stored);
        }
      }
    } catch {}
  }

  generate(): void {
    this.generating.set(true);
    this.api.post<{ mixes: HomeRecoResponse['mixesForYou'] }>('reco/mixes/regenerate', {}).subscribe({
      next: (payload) => {
        const cards = payload.mixes.map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: m.subtitle,
          thumbnailUrl: m.thumbnailUrl,
          previewThumbs: m.previewThumbs ?? [],
        }));
        this.mixes.set(cards);
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cards));
        } catch {}
        this.generating.set(false);
      },
      error: () => {
        this.generating.set(false);
      },
    });
  }
}