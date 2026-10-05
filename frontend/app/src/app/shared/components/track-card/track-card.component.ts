import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { ArtistLookupService } from '../../../core/services/artist-lookup.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { TagsService, type TagSort } from '../../../core/services/tags.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  PlayerService,
  type PlayerTrack,
  type QueueSource,
} from '../../../core/services/player.service';
import { AppTrack } from '../../models/track.model';
import { formatDurationClock, normalizeDurationSeconds } from '../../utils/duration.util';
import { ModalComponent } from '../modal/modal.component';
import { TranslatePipe } from '../../pipes/t.pipe';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ThumbComponent } from '../thumb/thumb.component';
import { parseErrorPayload } from '../../../shared/utils/error-payload.util';
import {
  buildPlaylistPreview,
  type PlaylistRow,
} from '../../../shared/utils/playlist-preview.util';

@Component({
  selector: 'app-track-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    TranslatePipe,
    ThumbComponent,
    IconComponent,
  ],
  template: `
    <div
      class="card"
      role="button"
      tabindex="0"
      [attr.aria-label]="('play' | t) + ': ' + track().title"
      (click)="onCardClick($event)"
      (keydown.enter)="onPlay()"
      (keydown.space)="$event.preventDefault(); onPlay()"
    >
      <div class="thumb-wrap">
        <app-thumb [src]="track().thumbnailUrl" [alt]="track().title" [size]="44" />
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
          <button type="button" class="artist" (click)="artistLookup.openArtist(track().artist)">
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
            <app-icon name="pause" [size]="ACTION_ICON_SIZE" />
          } @else {
            <app-icon name="play" [size]="ACTION_ICON_SIZE" />
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
            <app-icon name="heart" [size]="ACTION_ICON_SIZE" />
          } @else {
            <app-icon name="heart" [size]="ACTION_ICON_SIZE" [filled]="false" />
          }
        </button>
        @if (canTag()) {
          <button
            type="button"
            class="act tap"
            (click)="toggleTag()"
            [title]="'tag' | t"
            [attr.aria-label]="'tag' | t"
          >
            <app-icon name="tag" [size]="ACTION_ICON_SIZE" />
          </button>
        }
        <button
          type="button"
          class="act tap"
          (click)="openPlaylistModal()"
          [title]="'addToPlaylist' | t"
          [attr.aria-label]="'addToPlaylist' | t"
        >
          <app-icon name="plus" [size]="ACTION_ICON_SIZE" />
        </button>
      </div>
    </div>
    @if (trackTags().length > 0) {
      <div class="tags-line">
        @for (t of trackTags(); track t) {
          <span class="tag-chip">#{{ t }}</span>
        }
      </div>
    }
    @if (tagOpen()) {
      <div class="tag-panel">
        @if (trackTags().length > 0) {
          <div class="cur-tags">
            @for (t of trackTags(); track t) {
              <button
                type="button"
                class="cur-tag"
                (click)="removeTag(t)"
                [title]="'removeTag' | t"
              >
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
          <button
            type="button"
            class="sort-btn"
            [class.active]="tagSort() === 'createdAt'"
            (click)="tagSort.set('createdAt')"
          >
            {{ 'sortByDate' | t }}
          </button>
          <button
            type="button"
            class="sort-btn"
            [class.active]="tagSort() === 'alpha'"
            (click)="tagSort.set('alpha')"
          >
            {{ 'sortAZ' | t }}
          </button>
        </div>

        @if (distinctTags().length > 0) {
          <div class="tag-suggest">
            @for (t of distinctTags(); track t) {
              <button
                type="button"
                class="sug"
                (click)="submitTag(t)"
                [disabled]="
                  trackTags().some((x) => x.trim().toLowerCase() === t.trim().toLowerCase())
                "
              >
                #{{ t }}
              </button>
            }
          </div>
        }
      </div>
    }

    <app-modal
      [title]="'trackHasTags' | t"
      [isOpen]="confirmFavOpen()"
      (closed)="confirmFavOpen.set(false)"
    >
      <p>{{ 'removeTrackWithTagsConfirm' | t }}</p>
      <div class="confirm-row">
        <button type="button" class="tag-btn ghost" (click)="confirmFavOpen.set(false)">
          {{ 'no' | t }}
        </button>
        <button type="button" class="tag-btn" (click)="confirmRemoveFavorite()">
          {{ 'yes' | t }}
        </button>
      </div>
    </app-modal>

    <app-modal
      [title]="'addToPlaylist' | t"
      [isOpen]="playlistOpen()"
      (closed)="playlistOpen.set(false)"
    >
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
  styleUrl: './track-card.component.css',
})
export class TrackCardComponent {
  /**
   * One size for every icon in the action row. Icons ship with different
   * natural sizes (16/20/24 grids), so without this the row rendered mixed
   * glyph sizes and baselines.
   */
  protected readonly ACTION_ICON_SIZE = 18;

  private readonly api = inject(ApiService);
  readonly artistLookup = inject(ArtistLookupService);
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
  /** Pass 'history' to mark queue source as history for special UI handling. */
  readonly queueSource = input<QueueSource | undefined>(undefined);
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
    const source = this.queueSource();
    if (queue && queue.length > 0) {
      this.playerService.setQueue(queue, source ?? 'unknown');
    } else {
      this.playerService.setQueue([pt], source ?? 'unknown');
    }
    this.playerService.play(pt);
  }

  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    // The tag strip and the expanded tag panel live inside the clickable card
    // but are not the play trigger; listing them here keeps them out of the way
    // without putting a no-op click handler on non-interactive elements.
    if (target?.closest('button, input, textarea, select, a, .tags-line, .tag-panel')) {
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
            const payload = parseErrorPayload(err);
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
          const payload = parseErrorPayload(err);
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
}
