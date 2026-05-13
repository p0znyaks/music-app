import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';

interface PlaylistRow {
  id: number;
  name: string;
  trackCount: number;
  preview: { kind: 'mosaic'; urls: string[] } | { kind: 'single'; url: string | null };
}

@Component({
  selector: 'app-playlists',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page">
      <div class="head">
        <h1>{{ 'playlists' | t }}</h1>
        @if (!creating()) {
          <button type="button" class="new tap" (click)="creating.set(true)">+ {{ 'playlistsNew' | t }}</button>
        } @else {
          <div class="inline-form">
            <input type="text" [(ngModel)]="newName" [placeholder]="'playlistsNamePlaceholder' | t" class="inp" (keydown.enter)="create()" />
            <button type="button" class="btn primary tap" (click)="create()">{{ 'create' | t }}</button>
            <button type="button" class="btn ghost tap" (click)="cancelCreate()">{{ 'cancel' | t }}</button>
          </div>
        }
      </div>

      <div class="grid">
        @for (p of playlists(); track p.id) {
          <div class="card tap" (click)="open(p)">
            <div class="preview">
              @if (p.preview.kind === 'mosaic') {
                <div class="mosaic">
                  @for (u of p.preview.urls; track u) {
                    <img class="mosaic-img" [src]="u" alt="" loading="lazy" />
                  }
                </div>
              } @else {
                @if (p.preview.url) {
                  <img class="cover" [src]="p.preview.url" alt="" loading="lazy" />
                } @else {
                  <div class="cover ph" aria-hidden="true"></div>
                }
              }
            </div>

            <div class="p-name" title="{{ p.name }}">{{ p.name }}</div>
            <div class="meta">{{ p.trackCount }} {{ 'tracksSuffix' | t }}</div>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
    }
    .new {
      padding: 0.55rem 1rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent);
      cursor: pointer;
      font-size: 0.9rem;
      transition: transform 0.12s ease;
    }
    .new.tap:active {
      transform: scale(0.96);
    }
    .inline-form {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }
    .inp {
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--bg);
      min-width: 200px;
    }
    .btn {
      padding: 0.5rem 0.85rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 0.85rem;
    }
    .btn.primary {
      background: var(--accent);
      color: var(--bg);
      border-color: var(--accent);
    }
    .btn.ghost {
      background: transparent;
      color: var(--accent-dim);
    }
    .btn.danger {
      background: #ef4444;
      border-color: #ef4444;
      color: #0b0b0c;
      font-weight: 700;
    }
    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1rem;
      cursor: pointer;
      transition:
        background 0.2s ease,
        border-color 0.2s ease,
        transform 0.15s ease;
    }
    .card:hover {
      background: var(--bg-hover);
      border-color: var(--accent-dim);
    }
    .card.tap:active {
      transform: scale(0.99);
    }

    .preview {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--bg);
      margin-bottom: 0.75rem;
    }
    .cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .cover.ph {
      width: 100%;
      height: 100%;
      background:
        radial-gradient(60% 60% at 30% 25%, rgba(255, 255, 255, 0.14), transparent 65%),
        linear-gradient(135deg, rgba(138, 92, 255, 0.55), rgba(0, 229, 255, 0.25));
      filter: saturate(1.1);
    }
    .mosaic {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 2px;
      background: var(--overlay-chip-bg);
    }
    .mosaic-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .p-name {
      font-weight: 600;
      font-size: 1.05rem;
      line-height: 1.25;
      margin: 0.15rem 0 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .meta {
      font-size: 0.85rem;
      color: var(--accent-dim);
    }
  `,
})
export class PlaylistsComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly settings = inject(AppSettingsService);

  readonly playlists = signal<PlaylistRow[]>([]);
  readonly creating = signal(false);
  newName = '';
  constructor() {
    this.load();
  }

  private buildPreview(tracks: { thumbnailUrl: string | null }[]): PlaylistRow['preview'] {
    if (tracks.length === 0) {
      return { kind: 'single', url: null };
    }

    const first4 = tracks.slice(0, 4);
    if (first4.length < 4) {
      return { kind: 'single', url: first4[0]?.thumbnailUrl ?? null };
    }

    const urls = first4.map((t) => t.thumbnailUrl).filter((u): u is string => !!u);
    if (urls.length < 4) {
      return { kind: 'single', url: first4[0]?.thumbnailUrl ?? null };
    }

    const uniq = new Set(urls);
    if (uniq.size < 4) {
      return { kind: 'single', url: first4[0]?.thumbnailUrl ?? null };
    }

    return { kind: 'mosaic', urls };
  }

  load(): void {
    this.api.get<{ id: number; name: string; createdAt: string }[]>('playlists').subscribe({
      next: (list) => {
        if (list.length === 0) {
          this.playlists.set([]);
          return;
        }
        forkJoin(
          list.map((p) =>
            this.api
              .get<{ thumbnailUrl: string | null }[]>(`playlists/${p.id}/tracks`)
              .pipe(
                map((tracks) => ({
                  id: p.id,
                  name: p.name,
                  trackCount: tracks.length,
                  preview: this.buildPreview(tracks),
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
          next: (rows) => this.playlists.set(rows),
        });
      },
    });
  }

  cancelCreate(): void {
    this.creating.set(false);
    this.newName = '';
  }

  create(): void {
    const name = this.newName.trim();
    if (!name) {
      return;
    }
    if (name.length > 25) {
      this.toast.show(this.settings.t('playlistNameTooLong'));
      return;
    }
    const normalizedName = name.toLowerCase();
    const exists = this.playlists().some((p) => p.name.trim().toLowerCase() === normalizedName);
    if (exists) {
      this.toast.show(this.settings.t('playlistAlreadyExists'));
      return;
    }
    this.api.post<{ id: number }>('playlists', { name }).subscribe({
      next: () => {
        this.newName = '';
        this.creating.set(false);
        this.load();
      },
    });
  }

  open(p: PlaylistRow): void {
    void this.router.navigate(['/playlists', p.id], { state: { name: p.name } });
  }

}
