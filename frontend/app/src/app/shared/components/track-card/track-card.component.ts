import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ArtistLookupService } from '../../../core/services/artist-lookup.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { TagsService, type TagSort } from '../../../core/services/tags.service';
import { ToastService } from '../../../core/services/toast.service';
import { PlayerService, type PlayerTrack } from '../../../core/services/player.service';
import { AppTrack } from '../../models/track.model';
import { formatDurationClock, normalizeDurationSeconds } from '../../utils/duration.util';
import { ModalComponent } from '../modal/modal.component';
import { TranslatePipe } from '../../pipes/t.pipe';
import { AppSettingsService } from '../../../core/services/app-settings.service';

interface PlaylistRow {
  id: number;
  name: string;
  trackCount: number;
  preview: { kind: 'mosaic'; urls: string[] } | { kind: 'single'; url: string | null };
}

@Component({
  selector: 'app-track-card',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, TranslatePipe],
  template: `
    <div class="card" (click)="onCardClick($event)">
      <div class="thumb-wrap">
        @if (track().thumbnailUrl) {
          <img [src]="track().thumbnailUrl!" [alt]="track().title" width="44" height="44" />
        } @else {
          <div class="thumb-ph" aria-hidden="true"></div>
        }
      </div>
      <div class="info">
        <div class="title-row">
          <div class="title">{{ track().title }}</div>
          @if (isCurrentTrack() && isPlaying()) {
            <div class="eq" [attr.aria-label]="'nowPlaying' | t">
              <span></span>
              <span></span>
              <span></span>
            </div>
          }
          @if (isClip()) {
            <span class="row-badge">{{ 'clip' | t }}</span>
          }
        </div>
        <div class="meta">
          <button type="button" class="artist" (click)="openArtist(track().artist)">
            {{ track().artist }}
          </button>
          @if (showDuration() && durationLabel(); as dur) {
            <span class="meta-sep" aria-hidden="true">·</span>
            <span class="dur">{{ dur }}</span>
          }
        </div>
      </div>
      <div class="actions">
        <button
          type="button"
          class="act tap"
          (click)="onPlay()"
          [title]="'play' | t"
          [attr.aria-label]="'play' | t"
        >
          @if (isCurrentTrack() && isPlaying()) {
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.5 2.5c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v11c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-11zM8.5 2.5c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v11c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-11z"/>
            </svg>
          } @else {
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 2l10 6-10 6V2z"/>
            </svg>
          }
        </button>
        <button
          type="button"
          class="act tap fav"
          [class.fav-on]="favored()"
          (click)="onFavorite()"
          [title]="'favorite' | t"
          [attr.aria-label]="'favorite' | t"
        >
          @if (favored()) {
            <svg width="20" height="20" viewBox="-1 0 20 16" fill="currentColor" aria-hidden="true">
              <path d="M8 14l-1.09-.64C3.18 11.36 1 9.28 1 6.5 1 4.02 3.02 2 5.5 2c1.64 0 3.09.81 4 2.09C10.41 2.81 11.86 2 13.5 2 15.98 2 18 4.02 18 6.5c0 2.78-2.18 4.86-5.91 6.86L8 14z"/>
            </svg>
          } @else {
            <svg width="20" height="20" viewBox="-1 0 20 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M8 14l-1.09-.64C3.18 11.36 1 9.28 1 6.5 1 4.02 3.02 2 5.5 2c1.64 0 3.09.81 4 2.09C10.41 2.81 11.86 2 13.5 2 15.98 2 18 4.02 18 6.5c0 2.78-2.18 4.86-5.91 6.86L8 14z"/>
            </svg>
          }
        </button>
        @if (canTag()) {
          <button type="button" class="act tap" (click)="toggleTag()" [title]="'tag' | t" [attr.aria-label]="'tag' | t">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2h6.59a1 1 0 0 1 .7.29l5.42 5.42a1 1 0 0 1 0 1.41l-5.42 5.42a1 1 0 0 1-1.41 0L2 9.71A1 1 0 0 1 2 8.29V2z"/></svg>
          </button>
        }
        <button type="button" class="act tap" (click)="openPlaylistModal()" [title]="'addToPlaylist' | t" [attr.aria-label]="'addToPlaylist' | t">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v10M3 8h10"/></svg>
        </button>
      </div>
    </div>
    @if (trackTags().length > 0) {
      <div class="tags-line" (click)="$event.stopPropagation()">
        @for (t of trackTags(); track t) {
          <span class="tag-chip">#{{ t }}</span>
        }
      </div>
    }
    @if (tagOpen()) {
      <div class="tag-panel" (click)="$event.stopPropagation()">
        @if (trackTags().length > 0) {
          <div class="cur-tags">
            @for (t of trackTags(); track t) {
              <button type="button" class="cur-tag" (click)="removeTag(t)" [title]="'removeTag' | t">
                #{{ t }} <span aria-hidden="true">×</span>
              </button>
            }
          </div>
        }

        <div class="tag-row">
          <input
            type="text"
            [(ngModel)]="tagText"
            (input)="onTagInput($event)"
            maxlength="15"
            (keydown.enter)="submitTag()"
            [placeholder]="'tags' | t"
            class="tag-inp"
          />
          <button type="button" class="tag-btn" (click)="submitTag()">{{ 'add' | t }}</button>
        </div>

        <div class="tag-sort">
          <button type="button" class="sort-btn" [class.active]="tagSort() === 'createdAt'" (click)="tagSort.set('createdAt')">{{ 'sortByDate' | t }}</button>
          <button type="button" class="sort-btn" [class.active]="tagSort() === 'alpha'" (click)="tagSort.set('alpha')">{{ 'sortAZ' | t }}</button>
        </div>

        @if (distinctTags().length > 0) {
          <div class="tag-suggest">
            @for (t of distinctTags(); track t) {
              <button type="button" class="sug" (click)="submitTag(t)" [disabled]="trackTags().some(x => x.trim().toLowerCase() === t.trim().toLowerCase())">
                #{{ t }}
              </button>
            }
          </div>
        }
      </div>
    }

    <app-modal [title]="'trackHasTags' | t" [isOpen]="confirmFavOpen()" (closed)="confirmFavOpen.set(false)">
      <p>{{ 'removeTrackWithTagsConfirm' | t }}</p>
      <div class="confirm-row">
        <button type="button" class="tag-btn ghost" (click)="confirmFavOpen.set(false)">{{ 'no' | t }}</button>
        <button type="button" class="tag-btn" (click)="confirmRemoveFavorite()">{{ 'yes' | t }}</button>
      </div>
    </app-modal>

    <app-modal [title]="'addToPlaylist' | t" [isOpen]="playlistOpen()" (closed)="playlistOpen.set(false)">
      @if (loadingLists()) {
        <p>{{ 'loading' | t }}</p>
      } @else {
        <div class="pl-create">
          <input
            type="text"
            class="pl-inp"
            [(ngModel)]="newPlaylistName"
            [placeholder]="'newPlaylistNamePlaceholder' | t"
            (keydown.enter)="createPlaylistAndAdd()"
          />
          <button
            type="button"
            class="pl-create-btn tap"
            [disabled]="creatingPlaylist() || !newPlaylistName.trim()"
            (click)="createPlaylistAndAdd()"
          >
            {{ 'create' | t }}
          </button>
        </div>

        <div class="pl-sep"></div>

        @if (playlists().length === 0) {
          <p class="pl-empty">{{ 'noPlaylistsYet' | t }}</p>
        } @else {
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
                  <div class="pl-name" title="{{ p.name }}">{{ p.name }}</div>
                  <div class="pl-meta">{{ p.trackCount }} {{ 'tracksSuffix' | t }}</div>
                </div>
              </button>
            }
          </div>
        }
      }
    </app-modal>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      align-items: center;
      height: 64px;
      gap: 12px;
      padding: 0 12px;
      background: transparent;
      border-radius: 8px;
      transition: background 0.2s ease;
    }
    .card:hover {
      background: var(--bg-hover);
    }
    .thumb-wrap {
      flex-shrink: 0;
      border-radius: 6px;
      overflow: hidden;
      width: 44px;
      height: 44px;
    }
    .thumb-wrap img {
      display: block;
      width: 44px;
      height: 44px;
      object-fit: cover;
    }
    .thumb-ph {
      width: 44px;
      height: 44px;
      background: var(--border);
    }
    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      justify-content: center;
    }
    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--accent);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .eq {
      display: inline-flex;
      align-items: flex-end;
      gap: 2px;
      width: 14px;
      height: 12px;
      flex-shrink: 0;
    }
    .eq span {
      width: 3px;
      border-radius: 999px;
      background: var(--accent);
      transform-origin: bottom;
      animation: eq-wave 850ms ease-in-out infinite;
    }
    .eq span:nth-child(1) {
      height: 45%;
      animation-delay: 0ms;
    }
    .eq span:nth-child(2) {
      height: 75%;
      animation-delay: 140ms;
    }
    .eq span:nth-child(3) {
      height: 60%;
      animation-delay: 260ms;
    }
    @keyframes eq-wave {
      0%,
      100% {
        transform: scaleY(0.35);
        opacity: 0.85;
      }
      50% {
        transform: scaleY(1);
        opacity: 1;
      }
    }
    .row-badge {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent-dim);
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--bg-hover);
      border: 1px solid var(--border);
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      font-size: 12px;
      color: var(--accent-dim);
    }
    .artist {
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      text-align: left;
      font: inherit;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      color: var(--accent-dim);
      text-decoration: none;
      transition: color 0.2s ease;
    }
    .artist:hover,
    .artist:focus-visible {
      color: var(--accent);
      text-decoration: underline;
      outline: none;
    }
    .meta-sep {
      flex-shrink: 0;
      opacity: 0.55;
    }
    .dur {
      flex-shrink: 0;
      color: var(--accent-dim);
      font-variant-numeric: tabular-nums;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .act {
      min-width: 36px;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-dim);
      transition: color 0.2s ease, background 0.2s ease;
    }
    .act svg {
      width: 18px;
      height: 18px;
      display: block;
      flex-shrink: 0;
    }
    .act:hover {
      color: var(--accent);
      background: var(--bg-hover);
    }
    .act.tap:active {
      transform: scale(0.92);
    }
    .act.fav {
      color: var(--accent-dim);
    }
    .act.fav.fav-on {
      color: var(--accent);
    }
    .act.fav.fav-on:hover {
      color: var(--accent);
      background: var(--bg-hover);
    }
    .act.fav:not(.fav-on):hover {
      color: var(--accent);
    }
    .tag-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 8px;
      padding: 0 4px 8px;
    }
    .tags-line {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 12px 6px;
      margin-top: 2px;
    }
    .tag-chip {
      font-size: 12px;
      color: var(--accent-dim);
      background: var(--overlay-chip-bg);
      border: 1px solid var(--overlay-chip-border);
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .tag-panel {
      margin-top: 8px;
      padding: 8px 6px 6px;
      border-radius: 10px;
      background: var(--overlay-panel-bg);
      border: 1px solid var(--overlay-panel-border);
    }
    .cur-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 4px 6px;
    }
    .cur-tag {
      border: 1px solid var(--overlay-chip-border-strong);
      background: var(--overlay-chip-bg);
      color: var(--accent);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .cur-tag:hover {
      background: var(--overlay-panel-bg-strong);
    }
    .tag-sort {
      display: flex;
      gap: 8px;
      padding: 0 4px 6px;
    }
    .sort-btn {
      border: 1px solid var(--overlay-chip-border-mid);
      background: transparent;
      color: var(--accent-dim);
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .sort-btn.active {
      background: var(--overlay-chip-border-mid);
      color: var(--accent);
    }
    .tag-suggest {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 4px 6px;
      max-height: 96px;
      overflow: auto;
    }
    .sug {
      border: 1px solid var(--overlay-chip-border-mid);
      background: transparent;
      color: var(--accent-dim);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      cursor: pointer;
    }
    .sug:hover {
      color: var(--accent);
      border-color: var(--overlay-chip-border-strong);
    }
    .sug:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .confirm-row {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 12px;
    }
    .tag-inp {
      flex: 1;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg-hover);
      font-size: 14px;
      color: var(--accent);
    }
    .tag-btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: none;
      background: var(--accent);
      color: var(--bg);
      font-size: 13px;
      cursor: pointer;
    }
    .tag-btn.ghost {
      background: transparent;
      color: var(--accent-dim);
    }
    .pl-create {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 4px;
    }
    .pl-inp {
      flex: 1;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text, #fff);
      font-size: 14px;
      min-width: 0;
    }
    .pl-create-btn {
      flex-shrink: 0;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--accent);
      color: var(--bg);
      font-size: 13px;
      cursor: pointer;
      transition: transform 0.12s ease;
    }
    .pl-create-btn.tap:active {
      transform: scale(0.96);
    }
    .pl-create-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .pl-sep {
      height: 1px;
      background: var(--border);
      margin: 10px 0;
      opacity: 0.7;
    }
    .pl-empty {
      margin: 0;
      color: var(--accent-dim);
      font-size: 0.9rem;
    }
    .pl-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .pl-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--bg-card);
      color: inherit;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease, transform 0.12s ease;
    }
    .pl-row:hover {
      background: var(--bg-hover);
      border-color: var(--accent-dim);
    }
    .pl-row.tap:active {
      transform: scale(0.99);
    }
    .pl-prev {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--bg);
      flex-shrink: 0;
    }
    .pl-cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .pl-cover.ph {
      width: 100%;
      height: 100%;
      background:
        radial-gradient(60% 60% at 30% 25%, rgba(255, 255, 255, 0.14), transparent 65%),
        linear-gradient(135deg, rgba(138, 92, 255, 0.55), rgba(0, 229, 255, 0.25));
      filter: saturate(1.1);
    }
    .pl-mosaic {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 2px;
      background: var(--overlay-chip-bg);
    }
    .pl-mosaic-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .pl-txt {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .pl-name {
      color: var(--accent);
      font-weight: 700;
      font-size: 0.98rem;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pl-meta {
      font-size: 0.82rem;
      color: var(--accent-dim);
    }
  `,
})
export class TrackCardComponent {
  private readonly api = inject(ApiService);
  private readonly artistLookup = inject(ArtistLookupService);
  private readonly router = inject(Router);
  private readonly playerService = inject(PlayerService);
  private readonly toast = inject(ToastService);
  private readonly settings = inject(AppSettingsService);
  private readonly favorites = inject(FavoritesService);
  private readonly tagsService = inject(TagsService);

  readonly track = input.required<AppTrack>();
  /** When true, show duration next to the artist (e.g. on Search). */
  readonly showDuration = input(false);
  /** True only on playlist detail screen (track is in a playlist). */
  readonly inPlaylist = input(false);
  /** Allow tag editing UI in this context (Favorites/Playlist only). */
  readonly allowTagging = input(false);
  readonly queue = input<PlayerTrack[] | null>(null);
  readonly favoriteRemoved = output<void>();

  private readonly favIds = toSignal(this.favorites.favorites$, { initialValue: [] as string[] });
  private readonly normalizedTrackId = computed(() => (this.track().trackId ?? '').trim());
  readonly favored = computed(() => this.favIds().includes(this.normalizedTrackId()));
  readonly canTag = computed(() => this.allowTagging() && (this.favored() || this.inPlaylist()));

  readonly currentTrack = toSignal(this.playerService.currentTrack$, { initialValue: null });
  readonly isCurrentTrack = computed(() => this.currentTrack()?.trackId === this.track().trackId);
  readonly isPlaying = toSignal(this.playerService.isPlaying$, { initialValue: false });
  readonly isClip = computed(() => {
    const t = this.track();
    return typeof t.startTime === 'number' && typeof t.endTime === 'number';
  });

  readonly durationLabel = computed(() => {
    const d = normalizeDurationSeconds(this.track().duration);
    if (d == null) {
      return null;
    }
    return this.formatDuration(d);
  });

  readonly tagOpen = signal(false);
  readonly confirmFavOpen = signal(false);
  readonly playlistOpen = signal(false);
  readonly loadingLists = signal(false);
  readonly creatingPlaylist = signal(false);
  readonly playlists = signal<PlaylistRow[]>([]);
  newPlaylistName = '';

  tagText = '';
  readonly tagSort = signal<TagSort>('createdAt');

  readonly trackTags = toSignal(
    toObservable(this.normalizedTrackId).pipe(switchMap((id) => this.tagsService.getTrackTags(id))),
    { initialValue: [] as string[] },
  );
  readonly distinctTags = toSignal(
    toObservable(this.tagSort).pipe(switchMap((s) => this.tagsService.getDistinctTags(s))),
    { initialValue: [] as string[] },
  );

  constructor() {
    // Трековые карточки используются на разных экранах (например, Search),
    // поэтому обеспечиваем загрузку избранного без посещения страницы Favorites.
    this.favorites.ensureLoaded();
  }

  formatDuration(sec: number): string {
    return formatDurationClock(sec);
  }

  private asPlayerTrack(): PlayerTrack {
    const t = this.track();
    return {
      ...t,
      duration: normalizeDurationSeconds(t.duration) ?? undefined,
      thumbnailUrl: t.thumbnailUrl ?? undefined,
      startTime: t.startTime ?? undefined,
      endTime: t.endTime ?? undefined,
    };
  }

  onPlay(): void {
    const pt = this.asPlayerTrack();
    if (this.isCurrentTrack() && this.isPlaying()) {
      this.playerService.pause();
      return;
    }
    const queue = this.queue();
    if (queue && queue.length > 0) {
      this.playerService.setQueue(queue);
    } else {
      this.playerService.setQueue([pt]);
    }
    this.playerService.play(pt);
  }

  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, select, a')) {
      return;
    }
    this.onPlay();
  }

  onFavorite(): void {
    const t = this.track();
    const id = (t.trackId ?? '').trim();
    if (!id) {
      return;
    }
    if (this.favored()) {
      this.favorites.removeFavorite(id).subscribe({
        next: () => {
          this.tagsService.invalidate();
          this.favoriteRemoved.emit();
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            const payload = this.parseErrorPayload(err);
            if (payload?.requiresConfirm) {
              this.confirmFavOpen.set(true);
              return;
            }
          }
        },
      });
    } else {
      this.favorites.addFavorite({ ...t, trackId: id }).subscribe({
        next: () => {},
        error: () => {},
      });
    }
  }

  toggleTag(): void {
    if (!this.canTag()) {
      return;
    }
    this.tagOpen.update((v) => !v);
    if (!this.tagOpen()) {
      this.tagText = '';
    }
  }

  private tagNorm(s: string): string {
    return s.trim().toLowerCase();
  }

  onTagInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.tagText = input.value.replace(/\s/g, '');
    input.value = this.tagText;
  }

  submitTag(tagOverride?: string): void {
    if (!this.canTag()) {
      return;
    }
    const tag = (tagOverride ?? this.tagText).trim();
    if (!tag) {
      return;
    }
    if (tag.includes('#')) {
      this.toast.show(this.settings.t('removeHashHint'));
      return;
    }
    
    if (tag.length > 15) {
      this.toast.show(this.settings.t('max15Chars'));
      return;
    }
    const current = this.trackTags();
    if (current.length >= 4) {
      this.toast.show(this.settings.t('max4Tags'));
      return;
    }
    const norm = this.tagNorm(tag);
    if (current.some((t) => this.tagNorm(t) === norm)) {
      this.toast.show(this.settings.t('tagAlreadyAdded'));
      return;
    }
    if (!tagOverride) {
      const existingTags = this.distinctTags();
      if (existingTags.some((t) => this.tagNorm(t) === norm)) {
        this.toast.show(this.settings.t('tagAlreadyExists'));
        return;
      }
    }

    this.tagsService.addTagToTrack(this.track(), tag).subscribe({
      next: () => {
        this.tagText = '';
        this.toast.show(this.settings.t('tagAdded'));
      },
      error: (err) => {
        if (err instanceof HttpErrorResponse) {
          const payload = this.parseErrorPayload(err);
          const msg = typeof payload?.message === 'string' ? payload.message : null;
          if (err.status === 403) {
            this.toast.show(msg ?? this.settings.t('tagOnlyInPlaylistOrFavorites'));
            return;
          }
          if (err.status === 409) {
            this.toast.show(msg ?? this.settings.t('cannotAddTag'));
            return;
          }
          if (err.status === 400) {
            this.toast.show(msg ?? this.settings.t('invalidTag'));
            return;
          }
        }
      },
    });
  }

  removeTag(tag: string): void {
    const tid = this.normalizedTrackId();
    if (!tid) {
      return;
    }
    this.tagsService.removeTagFromTrack(tid, tag).subscribe({
      next: () => {},
      error: () => {},
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

  confirmRemoveFavorite(): void {
    const id = this.normalizedTrackId();
    if (!id) return;
    this.favorites.removeFavorite(id, true).subscribe({
      next: () => {
        this.tagsService.invalidate();
        this.confirmFavOpen.set(false);
        this.favoriteRemoved.emit();
      },
      error: () => {
        this.confirmFavOpen.set(false);
      },
    });
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

  private loadPlaylistsForModal(): void {
    this.loadingLists.set(true);
    this.api.get<{ id: number; name: string; createdAt: string }[]>('playlists').subscribe({
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

  openPlaylistModal(): void {
    this.playlistOpen.set(true);
    this.newPlaylistName = '';
    this.loadPlaylistsForModal();
  }

  createPlaylistAndAdd(): void {
    const name = this.newPlaylistName.trim();
    if (!name || this.creatingPlaylist()) {
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

    this.creatingPlaylist.set(true);
    this.api.post<{ id: number }>('playlists', { name }).subscribe({
      next: (res) => {
        const playlistId = res?.id;
        if (!playlistId) {
          this.creatingPlaylist.set(false);
          return;
        }
        this.addToPlaylist(playlistId, true, () => {
          this.newPlaylistName = '';
          this.creatingPlaylist.set(false);
        });
      },
      error: () => this.creatingPlaylist.set(false),
    });
  }

  addToPlaylist(playlistId: number, close = true, finallyCb?: () => void): void {
    const t = this.track();
    this.api
      .post(`playlists/${playlistId}/tracks`, {
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        thumbnailUrl: t.thumbnailUrl ?? undefined,
        duration: normalizeDurationSeconds(t.duration) ?? undefined,
      })
      .subscribe({
        next: () => {
          if (close) {
            this.playlistOpen.set(false);
          }
          finallyCb?.();
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.toast.show(this.settings.t('alreadyInPlaylist'));
          }
          finallyCb?.();
        },
      });
  }

  openArtist(artistName: string): void {
    const name = artistName.trim();
    if (!name) {
      return;
    }
    this.artistLookup.resolveBrowseIdByName(name).subscribe((browseId) => {
      if (!browseId) {
        return;
      }
      void this.router.navigate(['/artists', browseId]);
    });
  }
}
