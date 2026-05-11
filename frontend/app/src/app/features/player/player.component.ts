import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, ElementRef, HostListener, inject, signal, viewChild, viewChildren } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { catchError, filter, forkJoin, map, of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ArtistLookupService } from '../../core/services/artist-lookup.service';
import { AuthService } from '../../core/services/auth.service';
import { ListenHistoryCacheService } from '../../core/services/listen-history-cache.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { formatDurationClock, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ToastService } from '../../core/services/toast.service';

interface PlaylistRow {
  id: number;
  name: string;
  trackCount: number;
  preview: { kind: 'mosaic'; urls: string[] } | { kind: 'single'; url: string | null };
}

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, RouterLink, TranslatePipe],
  template: `
    <audio
      #audioRef
      (timeupdate)="onTimeUpdate()"
      (loadedmetadata)="onLoadedMeta()"
      (ended)="onEnded()"
      (play)="onAudioPlay()"
    ></audio>

    @if (track(); as t) {
      <div
        class="player-shell"
        [class.sheet-expanded]="isExpanded()"
        [class.queue-reordering]="!!queueReorderTrackId()"
      >
        <div class="player-scrim" [class.open]="isExpanded()" (click)="closeQueueSheet()"></div>
        <div class="player" [class.dragging]="isDragging()" [style.transform]="sheetTransform()">
          <div class="player-bar">
            <div class="zone left">
              <div class="thumb-wrap">
                @if (t.thumbnailUrl) {
                  <img [src]="t.thumbnailUrl" [alt]="t.title" width="72" height="72" />
                } @else {
                  <div class="thumb-ph"></div>
                }
              </div>
              <div class="meta">
                <div class="t-title">{{ t.title }}</div>
                <div class="t-artist-row">
                  <button type="button" class="t-artist" (click)="openArtist(t.artist)">{{ t.artist }}</button>
                  <span class="t-dur">{{ formatTime(t.duration ?? 0) }}</span>
                </div>
              </div>
            </div>

            <div class="zone center" (click)="onCenterZoneClick($event)">
              <div class="drag-zone" (mousedown)="onDragStart($event)" aria-label="Drag to open queue">
                <div class="drag-pill"></div>
              </div>
              <div class="btns">
                <button type="button" class="ctrl tap" (click)="player.prev()" aria-label="Previous">
                  <svg class="ico-prev" viewBox="0 0 16 16" fill="currentColor"><path d="M11 12V4l-6 4 6 4zM4 4v8h1V4H4z"/></svg>
                </button>
                @if (playing()) {
                  <button type="button" class="ctrl main tap" (click)="pause()" aria-label="Pause">
                    <svg class="ico-play" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="5" height="16" rx="1"/><rect x="13" y="4" width="5" height="16" rx="1"/></svg>
                  </button>
                } @else {
                  <button type="button" class="ctrl main tap" (click)="resume()" aria-label="Play">
                    <svg class="ico-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7-11-7z"/></svg>
                  </button>
                }
                <button type="button" class="ctrl tap" (click)="player.next()" aria-label="Next">
                  <svg class="ico-prev" viewBox="0 0 16 16" fill="currentColor"><path d="M5 4v8l6-4-6-4zm6 0v8h1V4h-1z"/></svg>
                </button>
              </div>
              <div class="progress-row">
                <span class="time">{{ formatTime(currentSec()) }}</span>
                <div class="bar-wrap" (click)="onBarClick($event)">
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
                <button type="button" class="clip-btn tap" (click)="openClip()" aria-label="Create clip">
                  <svg class="ico-clip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="20" y1="20" x2="8.12" y2="8.12"/></svg>
                </button>
              }
            </div>
          </div>

          <div class="queue-sheet">
            <div class="queue-head">
              <h3>{{ 'queue' | t }}</h3>
              <p>{{ queue().length }} {{ 'tracksSuffix' | t }}</p>
            </div>
            <div class="queue-list">
              @for (q of queue(); track q.trackId; let idx = $index) {
                <div
                  class="queue-row-wrap"
                  #queueRowWrap
                  [class.dragging-row]="queueReorderTrackId() === q.trackId"
                  [class.queue-row-wrap--current]="q.trackId === t.trackId"
                >
                  <button
                    type="button"
                    class="queue-grip tap"
                    (mousedown)="onQueueGripMouseDown($event, idx)"
                    title="Reorder"
                    aria-label="Reorder in queue"
                  >
                    <svg class="grip-svg" viewBox="0 0 12 20" aria-hidden="true" fill="currentColor">
                      <circle cx="3.5" cy="4.5" r="1.2" /><circle cx="8.5" cy="4.5" r="1.2" />
                      <circle cx="3.5" cy="10.5" r="1.2" /><circle cx="8.5" cy="10.5" r="1.2" />
                      <circle cx="3.5" cy="16.5" r="1.2" /><circle cx="8.5" cy="16.5" r="1.2" />
                    </svg>
                  </button>
                  <button type="button" class="queue-row" (click)="playFromQueue(q)">
                    <div class="queue-thumb">
                      @if (q.thumbnailUrl) {
                        <img [src]="q.thumbnailUrl" [alt]="q.title" />
                      } @else {
                        <div class="queue-thumb-ph"></div>
                      }
                    </div>
                    <div class="queue-meta">
                      <div class="queue-title">
                        {{ q.title }}
                        @if (q.trackId === t.trackId && playing()) {
                          <div class="eq" aria-hidden="true"><span></span><span></span><span></span></div>
                        }
                      </div>
                      <div class="queue-artist-row">
                        <div class="queue-artist">{{ q.artist }}</div>
                        <span class="queue-dur">{{ formatTime(q.duration ?? 0) }}</span>
                      </div>
                    </div>
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }

    <app-modal [title]="'createClip' | t" [isOpen]="clipOpen()" (closed)="closeClip()">
      @if (track(); as t) {
        <p class="clip-preview">{{ formatTime(clipStart()) }} — {{ formatTime(clipEnd()) }} · {{ formatTime(Math.max(0, clipEnd() - clipStart())) }}</p>
        <label class="rng-lab">
          <span>{{ 'clipName' | t }}</span>
          <input
            type="text"
            class="clip-name-input"
            [ngModel]="clipName()"
            (ngModelChange)="clipName.set(($event ?? '').toString())"
            [placeholder]="'clipNamePlaceholder' | t"
          />
        </label>
        <label class="rng-lab">
          <span>{{ 'startSeconds' | t }}</span>
          <input
            type="range"
            [min]="0"
            [max]="clipMax()"
            [step]="1"
            [ngModel]="clipStart()"
            (ngModelChange)="onClipStartChange($event)"
          />
        </label>
        <label class="rng-lab">
          <span>{{ 'endSeconds' | t }}</span>
          <input
            type="range"
            [min]="0"
            [max]="clipMax()"
            [step]="1"
            [ngModel]="clipEnd()"
            (ngModelChange)="onClipEndChange($event)"
          />
        </label>
        @if (clipError()) {
          <p class="err">{{ clipError() }}</p>
        }
        @if (clipResult(); as cr) {
          <p class="ok">{{ 'clipReady' | t }}</p>
          <a class="link" [routerLink]="['/clip', cr]">Open /clip/{{ cr }}</a>
          <button type="button" class="copy tap" (click)="copyClip(cr)">{{ 'copyLink' | t }}</button>
          <div class="pl-create">
            <input
              type="text"
              class="pl-inp"
              [(ngModel)]="newPlaylistName"
              [placeholder]="'newPlaylistNamePlaceholder' | t"
              (keydown.enter)="createPlaylistAndAddClip()"
            />
            <button type="button" class="pl-create-btn tap" [disabled]="creatingPlaylist() || !newPlaylistName.trim()" (click)="createPlaylistAndAddClip()">
              {{ 'create' | t }}
            </button>
          </div>
          @if (loadingLists()) {
            <p class="ok">{{ 'loading' | t }}</p>
          } @else if (playlists().length > 0) {
            <div class="pl-list" role="list">
              @for (p of playlists(); track p.id) {
                <button type="button" class="pl-row tap" (click)="addClipToPlaylist(p.id)">
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
                    <div class="pl-name">{{ p.name }}</div>
                    <div class="pl-meta">{{ p.trackCount }} {{ 'tracksSuffix' | t }}</div>
                  </div>
                  @if (clipAddedPlaylistId() === p.id) {
                    <span class="pl-added">{{ 'clipAddedToPlaylist' | t }}</span>
                  }
                </button>
              }
            </div>
          }
        } @else {
          <button type="button" class="copy tap" [disabled]="clipSaving()" (click)="previewClip()">
            {{ clipPreviewPlaying() ? ('pause' | t) : ('previewClip' | t) }}
          </button>
          <button type="button" class="create tap" [disabled]="clipSaving()" (click)="createClip()">{{ 'create' | t }}</button>
        }
      }
    </app-modal>
  `,
  styles: `
    :host {
      display: block;
    }
    audio {
      display: none;
    }
    .player-shell {
      position: fixed;
      bottom: 10px;
      left: 240px;
      right: 0;
      top: 0;
      z-index: 30;
      pointer-events: none;
    }
    .player-shell.sheet-expanded {
      bottom: 0;
    }
    .player-scrim {
      position: absolute;
      inset: 0;
      background: var(--scrim-bg);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.24s ease;
    }
    .player-scrim.open {
      opacity: 1;
      pointer-events: auto;
    }
    .player {
      position: absolute;
      inset: 0;
      pointer-events: auto;
      display: grid;
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid var(--border);
      border-radius: 14px 14px 0 0;
      grid-template-rows: 112px minmax(0, 1fr);
      transition: transform 0.3s ease;
      will-change: transform;
      overflow: hidden;
    }
    .player.dragging {
      transition: none;
    }
    .drag-zone {
      width: 70px;
      height: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: ns-resize;
      user-select: none;
    }
    .drag-pill {
      width: 54px;
      height: 4px;
      border-radius: 999px;
      background: var(--accent-dim);
      opacity: 0.8;
    }
    .player-bar {
      display: grid;
      grid-template-columns: minmax(300px, 380px) 1fr 200px;
      align-items: center;
      height: 112px;
      padding: 10px 0 16px;
    }
    .zone {
      display: flex;
      align-items: center;
      min-width: 0;
      height: 100%;
    }
.left {
      gap: 14px;
      padding-left: 24px;
      min-width: 0;
      align-self: center;
      flex-shrink: 1;
      max-width: 380px;
    }
    .meta {
      min-width: 0;
      flex: 1;
      max-width: 280px;
      display: flex;
      flex-direction: column;
    }
    .thumb-wrap {
      width: 72px;
      height: 72px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    }
    .thumb-wrap img {
      width: 72px;
      height: 72px;
      object-fit: cover;
      display: block;
    }
    .thumb-ph {
      width: 72px;
      height: 72px;
      background: var(--border);
    }
    .meta {
      min-width: 0;
    }
    .t-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--accent);
      max-width: 280px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.25;
    }
    .t-artist-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 2px;
    }
    .t-artist {
      display: inline-block;
      max-width: 200px;
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      text-align: left;
      font-size: 14px;
      color: var(--accent-dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none;
      transition: color 0.2s ease;
    }
    .t-artist:hover {
      color: var(--accent);
      text-decoration: underline;
    }
    .t-artist:focus-visible {
      color: var(--accent);
      text-decoration: underline;
      outline: none;
    }
    .t-dur {
      font-size: 14px;
      color: var(--accent-dim);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .center {
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-width: 280px;
      padding: 0 24px;
      align-self: center;
    }
    .btns {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 36px;
    }
    .ico-prev {
      width: 22px;
      height: 22px;
      display: block;
    }
    .ico-play {
      width: 32px;
      height: 32px;
      display: block;
    }
    .ico-clip {
      width: 20px;
      height: 20px;
      display: block;
    }
    .ctrl {
      width: auto;
      height: auto;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent);
      transition: transform 0.12s ease, opacity 0.2s ease;
    }
    .ctrl:hover {
      opacity: 0.85;
    }
    .ctrl.tap:active {
      transform: scale(0.9);
    }
    .ctrl.main {
      padding: 8px;
    }
    .progress-row {
      display: flex;
      align-items: center;
      gap: 14px;
      width: min(560px, 100%);
      transform: translateY(-10px);
    }
    .progress-row .time {
      font-size: 13px;
      color: var(--accent-dim);
      flex-shrink: 0;
      min-width: 42px;
      font-variant-numeric: tabular-nums;
    }
    .progress-row .time:last-child {
      text-align: right;
    }
    .bar-wrap {
      flex: 1;
      cursor: pointer;
      padding: 10px 0;
    }
    .bar-bg {
      position: relative;
      height: 8px;
      background: var(--border);
      border-radius: 4px;
    }
    .bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 4px;
      transition: width 0.05s linear;
    }
    .bar-knob {
      position: absolute;
      top: 50%;
      width: 14px;
      height: 14px;
      margin-left: -7px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 2px 6px var(--bar-knob-shadow);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
      transform: translateY(-50%);
    }
    .bar-wrap:hover .bar-knob {
      opacity: 1;
    }
    .right {
      justify-content: flex-end;
      padding-right: 24px;
      align-self: center;
    }
    .queue-sheet {
      border-top: 1px solid var(--border);
      padding: 14px 18px 18px;
      /* Grid row is minmax(0, 1fr); need min-height + overflow so inner scroll works with many tracks */
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .queue-head {
      flex-shrink: 0;
    }
    .queue-head h3 {
      font-size: 1.05rem;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .queue-head p {
      font-size: 0.86rem;
      color: var(--accent-dim);
    }
    .queue-list {
      flex: 1 1 0%;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      padding-right: 4px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overscroll-behavior: contain;
    }
    .player-shell.queue-reordering .queue-list {
      cursor: grabbing;
    }
    .queue-row-wrap {
      flex-shrink: 0;
      display: flex;
      align-items: stretch;
      width: 100%;
      gap: 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: transparent;
      transition:
        opacity 0.2s ease,
        border-color 0.22s ease,
        box-shadow 0.22s ease;
    }
    .queue-row-wrap:hover {
      border-color: var(--accent-dim);
    }
    .queue-row-wrap.queue-row-wrap--current {
      border-color: var(--accent-dim);
    }
    .queue-row-wrap.dragging-row {
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      opacity: 0.97;
    }
    .queue-grip {
      flex-shrink: 0;
      width: 38px;
      border: none;
      background: var(--overlay-panel-bg);
      color: var(--accent-dim);
      display: grid;
      place-items: center;
      cursor: grab;
      transition: background 0.22s ease, color 0.22s ease;
    }
    .queue-grip:hover {
      background: var(--overlay-panel-bg-strong);
      color: var(--accent);
    }
    .player-shell.queue-reordering .queue-grip {
      cursor: grabbing;
      color: var(--accent);
      background: var(--overlay-panel-bg-strong);
    }
    .queue-grip .grip-svg {
      width: 12px;
      height: 20px;
      display: block;
    }
    .queue-grip.tap:active:not(:disabled) {
      transform: scale(0.92);
    }
    .queue-row {
      border: none;
      background: var(--bg);
      flex: 1;
      border-radius: 0;
      min-width: 0;
      min-height: 62px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      text-align: left;
      color: var(--accent);
    }
    .queue-row:hover {
      background: var(--bg-hover);
    }
    .queue-row-wrap--current .queue-row {
      background: var(--bg-hover);
    }
    .queue-thumb {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      background: var(--bg-hover);
    }
    .queue-thumb img,
    .queue-thumb-ph {
      width: 44px;
      height: 44px;
      display: block;
      object-fit: cover;
    }
    .queue-meta {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .queue-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.92rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .queue-artist-row {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }
    .queue-artist {
      font-size: 0.82rem;
      color: var(--accent-dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .queue-dur {
      font-size: 0.82rem;
      color: var(--accent-dim);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
      display: inline;
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
.clip-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
      color: var(--accent-dim);
      font-size: 14px;
      transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
    }
    .clip-btn:hover:not(:disabled) {
      color: var(--accent);
      border-color: var(--accent-dim);
      background: var(--overlay-panel-bg-strong);
    }
    .clip-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .clip-btn.tap:active:not(:disabled) {
      transform: scale(0.95);
    }
    .clip-label {
      font-size: 13px;
      color: var(--accent-dim);
      transition: color 0.2s ease;
    }
    .clip-btn:hover:not(:disabled) {
      color: var(--accent);
      border-color: var(--accent-dim);
      background: var(--overlay-panel-bg-strong);
    }
    .clip-btn:hover:not(:disabled) .clip-label {
      color: var(--accent);
    }
    .clip-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .clip-btn.tap:active:not(:disabled) {
      transform: scale(0.92);
    }
    .clip-preview {
      margin-bottom: 1rem;
      font-size: 14px;
      color: var(--accent-dim);
    }
    .rng-lab {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 1rem;
      font-size: 13px;
      color: var(--accent-dim);
    }
    .rng-lab input {
      width: 100%;
      accent-color: var(--accent);
    }
    .create,
    .copy {
      margin-top: 1rem;
      width: 100%;
      padding: 12px 16px;
      border-radius: 8px;
      border: none;
      background: var(--accent);
      color: var(--bg);
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
    }
    .copy {
      margin-top: 12px;
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--border);
    }
    .err {
      color: #e5534b;
      font-size: 13px;
      margin-top: 8px;
    }
    .ok {
      color: var(--accent-dim);
      font-size: 13px;
      margin-top: 8px;
    }
    .link {
      display: inline-block;
      margin-top: 8px;
      color: var(--accent);
      text-decoration: underline;
      font-size: 14px;
    }
    .clip-name-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text, #fff);
      font-size: 14px;
    }
    .pl-create {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
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
    }
    .pl-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 220px;
      overflow-y: auto;
      margin-top: 12px;
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
      background: var(--bg-hover);
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
      flex: 1;
    }
    .pl-name {
      color: var(--accent);
      font-weight: 700;
      font-size: 0.95rem;
      line-height: 1.2;
    }
    .pl-meta,
    .pl-added {
      font-size: 0.78rem;
      color: var(--accent-dim);
    }
  `,
})
export class PlayerComponent {
  readonly player = inject(PlayerService);
  private readonly api = inject(ApiService);
  private readonly artistLookup = inject(ArtistLookupService);
  private readonly auth = inject(AuthService);
  private readonly listenHistoryCache = inject(ListenHistoryCacheService);
  private readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);

  readonly audioRef = viewChild<ElementRef<HTMLAudioElement>>('audioRef');
  readonly queueRowWraps = viewChildren<ElementRef<HTMLElement>>('queueRowWrap');

  readonly track = toSignal(this.player.currentTrack$, { initialValue: null });
  readonly playing = toSignal(this.player.isPlaying$, { initialValue: false });
  readonly queue = toSignal(this.player.queue$, { initialValue: [] as PlayerTrack[] });

  readonly progress = signal(0);
  readonly currentSec = signal(0);
  readonly totalSec = signal(0);
  readonly isExpanded = signal(false);
  readonly isDragging = signal(false);
  readonly dragOffset = signal(0);
  readonly viewportHeight = signal(typeof window !== 'undefined' ? window.innerHeight : 1080);
  /** While non-null, dragging to reorder queue rows (by trackId of grabbed row). */
  readonly queueReorderTrackId = signal<string | null>(null);

  private clipEnforceTimer: ReturnType<typeof setInterval> | null = null;
  private lastClipTrackId: string | null = null;
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

  readonly clipOpen = signal(false);
  readonly clipStart = signal(0);
  readonly clipEnd = signal(30);
  readonly clipMax = signal(180);
  readonly clipSaving = signal(false);
  readonly clipError = signal('');
  readonly clipResult = signal<string | null>(null);
  readonly clipName = signal('');
  readonly clipPreviewPlaying = signal(false);
  readonly loadingLists = signal(false);
  readonly creatingPlaylist = signal(false);
  readonly playlists = signal<PlaylistRow[]>([]);
  readonly clipAddedPlaylistId = signal<number | null>(null);
  newPlaylistName = '';

  protected readonly Math = Math;

  private historyLoggedFor: string | null = null;
  private dragStartY = 0;
  private dragStartExpanded = false;
  private suppressToggleUntil = 0;

constructor() {
    effect(() => {
      const t = this.track();
      const ref = this.audioRef();
      this.historyLoggedFor = null;
      this.lastClipTrackId = null;
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
      const isClip = t?.trackId.startsWith('clip:') && typeof t.startTime === 'number' && typeof t.endTime === 'number';
      const hasStartTime = typeof t?.startTime === 'number';
      this.totalSec.set(t && isClip ? t.endTime! - t.startTime! : (normalizeDurationSeconds(t?.duration) ?? 0));
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

      el.onerror = () => this.player.pause();
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

    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(() => {
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

    const target = ev.target as (EventTarget & { tagName?: string; isContentEditable?: boolean }) | null;
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
    if (this.queueReorderTrackId() !== null) {
      this.handleQueueReorderPointerMove(ev.clientY);
      return;
    }
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
    if (this.queueReorderTrackId() !== null) {
      this.finishQueueReorder();
      return;
    }
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

  closeQueueSheet(): void {
    this.isExpanded.set(false);
    this.isDragging.set(false);
    this.dragOffset.set(0);
  }

  playFromQueue(track: PlayerTrack): void {
    this.player.play(track);
  }

  onQueueGripMouseDown(ev: MouseEvent, startIndex: number): void {
    if (ev.button !== 0) {
      return;
    }
    const list = this.queue();
    const row = list[startIndex];
    if (!row) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    this.queueReorderTrackId.set(row.trackId);
    document.body.style.userSelect = 'none';
    this.handleQueueReorderPointerMove(ev.clientY);
  }

  private handleQueueReorderPointerMove(clientY: number): void {
    const tid = this.queueReorderTrackId();
    if (!tid) {
      return;
    }
    const q = this.queue();
    const wraps = this.queueRowWraps();
    if (!q.length || !wraps.length) {
      return;
    }
    const rows = wraps.map((r) => r.nativeElement);
    const targetIdx = this.queueInsertIndexFromPointerY(clientY, rows);

    const fromIdx = q.findIndex((t) => t.trackId === tid);
    if (fromIdx < 0) {
      this.finishQueueReorder();
      return;
    }
    if (fromIdx !== targetIdx) {
      this.player.moveQueueItem(fromIdx, targetIdx);
    }
  }

  /** Row index whose vertical midpoint cursor is inside (drops before midpoint at i). */
  private queueInsertIndexFromPointerY(y: number, rows: HTMLElement[]): number {
    if (rows.length === 0) {
      return 0;
    }
    const firstRect = rows[0]!.getBoundingClientRect();
    if (y < firstRect.top + firstRect.height / 2) {
      return 0;
    }
    const lastRect = rows[rows.length - 1]!.getBoundingClientRect();
    if (y >= lastRect.top + lastRect.height / 2) {
      return rows.length - 1;
    }
    for (let i = 0; i < rows.length; i += 1) {
      const rect = rows[i]!.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (y < mid) {
        return i;
      }
    }
    return rows.length - 1;
  }

  private finishQueueReorder(): void {
    if (this.queueReorderTrackId() === null) {
      return;
    }
    this.queueReorderTrackId.set(null);
    document.body.style.userSelect = '';
  }

  onTimeUpdate(): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    if (!el.duration || !isFinite(el.duration)) return;
    const t = this.track();
    const isClip = t?.trackId.startsWith('clip:') && typeof t.startTime === 'number' && typeof t.endTime === 'number';
    
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

    if (this.clipOpen() && this.clipPreviewPlaying() && el.currentTime >= this.clipEnd()) {
      el.pause();
      this.clipPreviewPlaying.set(false);
      el.currentTime = this.clipStart();
    }
  }

  onLoadedMeta(): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    const t = this.track();
    const isClip = t?.trackId.startsWith('clip:') && typeof t.startTime === 'number' && typeof t.endTime === 'number';
    if (t && isClip) {
      this.totalSec.set(t.endTime! - t.startTime!);
    } else if (isFinite(el.duration) && el.duration > 0) {
      this.totalSec.set(el.duration);
    }
  }

  onEnded(): void {
    this.player.next();
  }

  onAudioPlay(): void {
    const t = this.track();
    if (!t || this.historyLoggedFor === t.trackId) return;
    if (t.trackId.startsWith('clip:')) return;
    this.historyLoggedFor = t.trackId;
    this.listenHistoryCache.record({
      trackId: t.trackId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.thumbnailUrl ?? null,
    });
    this.api
      .post('history', {
        trackId: t.trackId,
        title: t.title,
        artist: t.artist,
        thumbnailUrl: t.thumbnailUrl ?? undefined,
      })
      .subscribe({ error: () => {} });
  }

  pause(): void {
    this.player.pause();
  }

  resume(): void {
    const t = this.track();
    const ref = this.audioRef();
    if (ref && t?.trackId.startsWith('clip:') && typeof t.startTime === 'number' && typeof t.endTime === 'number') {
      const el = ref.nativeElement;
      if (el.ended || el.currentTime >= t.endTime!) {
        el.currentTime = t.startTime!;
      }
    }
    this.player.resume();
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
    const isClip = t?.trackId.startsWith('clip:') && typeof t.startTime === 'number' && typeof t.endTime === 'number';
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
    if (this.isClipTrack()) return;
    const t = this.track();
    if (!t) return;
    const fallbackDuration = normalizeDurationSeconds(t.duration) ?? 180;
    const max = Math.max(1, Math.floor(this.totalSec() || fallbackDuration));
    this.clipMax.set(max);
    this.clipStart.set(0);
    this.clipEnd.set(Math.min(30, max));
    this.clipError.set('');
    this.clipResult.set(null);
    this.clipName.set(t.title);
    this.newPlaylistName = '';
    this.clipAddedPlaylistId.set(null);
    this.clipPreviewPlaying.set(false);
    this.clipOpen.set(true);
    this.loadPlaylistsForModal();
  }

  closeClip(): void {
    this.clipPreviewPlaying.set(false);
    this.clipOpen.set(false);
  }

  onClipStartChange(v: number): void {
    const max = this.clipMax();
    const end = this.clipEnd();
    const start = Math.max(0, Math.min(max, Math.floor(v)));
    this.clipStart.set(start);
    if (start >= end) this.clipEnd.set(Math.min(max, start + 1));
  }

  onClipEndChange(v: number): void {
    const max = this.clipMax();
    const start = this.clipStart();
    const end = Math.max(0, Math.min(max, Math.floor(v)));
    this.clipEnd.set(end);
    if (end <= start) this.clipStart.set(Math.max(0, end - 1));
  }

  createClip(): void {
    const t = this.track();
    if (!t) return;
    const start = this.clipStart();
    const end = this.clipEnd();
    const clipName = this.clipName().trim();
    if (end <= start) {
      this.clipError.set(this.settings.t('endMustBeGreater'));
      return;
    }
    if (!clipName) {
      this.clipError.set(this.settings.t('clipNameRequired'));
      return;
    }
    this.clipError.set('');
    this.clipSaving.set(true);
    this.api
      .post<{ shortCode: string }>('clips', {
        trackId: t.trackId,
        title: t.title,
        clipName,
        artist: t.artist,
        thumbnailUrl: '/clip-cover.svg',
        startTime: start,
        endTime: end,
      })
      .subscribe({
        next: (res) => {
          this.clipResult.set(res.shortCode);
          this.clipSaving.set(false);
        },
        error: () => {
          this.clipError.set(this.settings.t('failedCreateClip'));
          this.clipSaving.set(false);
        },
      });
  }

  copyClip(code: string): void {
    const url = `${window.location.origin}/clip/${code}`;
    void navigator.clipboard.writeText(url);
  }

  previewClip(): void {
    const ref = this.audioRef();
    if (!ref) return;
    const el = ref.nativeElement;
    if (this.clipPreviewPlaying()) {
      el.pause();
      this.clipPreviewPlaying.set(false);
      return;
    }
    el.currentTime = this.clipStart();
    this.clipPreviewPlaying.set(true);
    void el.play().catch(() => {
      this.clipPreviewPlaying.set(false);
    });
  }

  private buildPreview(tracks: { thumbnailUrl: string | null }[]): PlaylistRow['preview'] {
    if (tracks.length === 0) return { kind: 'single', url: null };
    const first4 = tracks.slice(0, 4);
    if (first4.length < 4) return { kind: 'single', url: first4[0]?.thumbnailUrl ?? null };
    const urls = first4.map((row) => row.thumbnailUrl).filter((u): u is string => !!u);
    if (urls.length < 4 || new Set(urls).size < 4) return { kind: 'single', url: first4[0]?.thumbnailUrl ?? null };
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
              catchError(() => of({ id: p.id, name: p.name, trackCount: 0, preview: { kind: 'single' as const, url: null } })),
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

  createPlaylistAndAddClip(): void {
    const name = this.newPlaylistName.trim();
    if (!name || this.creatingPlaylist()) return;
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
        if (!res?.id) {
          this.creatingPlaylist.set(false);
          return;
        }
        this.addClipToPlaylist(res.id, () => {
          this.newPlaylistName = '';
          this.creatingPlaylist.set(false);
        });
      },
      error: () => this.creatingPlaylist.set(false),
    });
  }

  addClipToPlaylist(playlistId: number, done?: () => void): void {
    const t = this.track();
    const code = this.clipResult();
    if (!t || !code) {
      done?.();
      return;
    }
    this.api
      .post(`playlists/${playlistId}/tracks`, {
        trackId: `clip:${code}`,
        title: this.clipName().trim(),
        artist: t.artist,
        thumbnailUrl: '/clip-cover.svg',
        duration: Math.max(1, this.clipEnd() - this.clipStart()),
        isClip: true,
      })
      .subscribe({
        next: () => {
          this.clipAddedPlaylistId.set(playlistId);
          this.loadPlaylistsForModal();
          done?.();
        },
        error: (err) => {
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.toast.show(this.settings.t('clipNameDuplicateInPlaylist'));
          }
          done?.();
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
