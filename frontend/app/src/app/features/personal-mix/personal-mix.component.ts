import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { ApiService } from '../../core/services/api.service';
import type { HomeRecoResponse } from '../home/home.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

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
  imports: [CommonModule, RouterLink, TranslatePipe, EmptyStateComponent, SkeletonComponent],
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
        <app-empty-state
          titleKey="personalMixEmpty"
          [actionKey]="generating() ? null : 'personalMixGenerate'"
          (action)="generate()"
        />
      }
    </div>
  `,
  styleUrl: './personal-mix.component.css',
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
    } catch {
      // localStorage is unavailable in private mode or when the quota is
      // exhausted; the page still works, it just will not remember the mix.
    }
  }

  generate(): void {
    this.generating.set(true);
    this.api
      .post<{ mixes: HomeRecoResponse['mixesForYou'] }>('reco/mixes/regenerate', {})
      .subscribe({
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
          } catch {
            // Same reasoning as in load(): failing to cache the freshly generated
            // mixes is not worth surfacing to the user.
          }
          this.generating.set(false);
        },
        error: () => {
          this.generating.set(false);
        },
      });
  }
}
