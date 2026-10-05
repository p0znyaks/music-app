import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { buildPlaylistPreview, type PlaylistRow } from '../../shared/utils/playlist-preview.util';

@Component({
  selector: 'app-playlists',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="page">
      <div class="head">
        <h1>{{ 'playlists' | t }}</h1>
        @if (!creating()) {
          <button type="button" class="new tap" (click)="creating.set(true)">
            + {{ 'playlistsNew' | t }}
          </button>
        } @else {
          <div class="inline-form">
            <input
              type="text"
              [(ngModel)]="newName"
              [placeholder]="'playlistsNamePlaceholder' | t"
              class="inp"
              (keydown.enter)="create()"
            />
            <button type="button" class="btn primary tap" (click)="create()">
              {{ 'create' | t }}
            </button>
            <button type="button" class="btn ghost tap" (click)="cancelCreate()">
              {{ 'cancel' | t }}
            </button>
          </div>
        }
      </div>

      <div class="grid">
        @for (p of playlists(); track p.id) {
          <div
            class="card tap"
            role="button"
            tabindex="0"
            (click)="open(p)"
            (keydown.enter)="open(p)"
          >
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
  styleUrl: './playlists.component.css',
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

  load(): void {
    this.api.get<{ id: number; name: string; createdAt: string }[]>('playlists').subscribe({
      next: (list) => {
        if (list.length === 0) {
          this.playlists.set([]);
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
