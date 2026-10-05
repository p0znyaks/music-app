import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  PlayerService,
  type PlayerTrack,
  type QueueSource,
} from '../../../core/services/player.service';
import { ThumbComponent } from '../../../shared/components/thumb/thumb.component';
import { TranslatePipe } from '../../../shared/pipes/t.pipe';
import { formatDurationClock } from '../../../shared/utils/duration.util';

/**
 * Slide-up sheet listing the playback queue with drag-to-reorder.
 *
 * Owns the reorder gesture end to end: measures its own rows, follows the
 * pointer while a row is grabbed and commits the new order to PlayerService.
 */
@Component({
  selector: 'app-queue-sheet',
  standalone: true,
  imports: [CommonModule, ThumbComponent, TranslatePipe],
  template: `
    <div class="queue-head">
      <h3>{{ 'queue' | t }}</h3>
      <p>{{ queue().length }} {{ 'tracksSuffix' | t }}</p>
    </div>
    <div class="queue-list">
      @for (q of queue(); track q.trackId; let idx = $index) {
        <div
          class="queue-row-wrap"
          #queueRowWrap
          [class.dragging-row]="reorderTrackId() === q.trackId"
          [class.queue-row-wrap--current]="q.trackId === currentTrackId()"
        >
          <button
            type="button"
            class="queue-grip tap"
            (mousedown)="onGripMouseDown($event, idx)"
            title="Reorder"
            aria-label="Reorder in queue"
          >
            <svg class="grip-svg" viewBox="0 0 12 20" aria-hidden="true" fill="currentColor">
              <circle cx="3.5" cy="4.5" r="1.2" />
              <circle cx="8.5" cy="4.5" r="1.2" />
              <circle cx="3.5" cy="10.5" r="1.2" />
              <circle cx="8.5" cy="10.5" r="1.2" />
              <circle cx="3.5" cy="16.5" r="1.2" />
              <circle cx="8.5" cy="16.5" r="1.2" />
            </svg>
          </button>
          <button type="button" class="queue-row" (click)="play(q)">
            <div class="queue-thumb">
              <app-thumb [src]="q.thumbnailUrl" [alt]="q.title" variant="queue" />
            </div>
            <div class="queue-meta">
              <div class="queue-title">
                {{ q.title }}
                @if (q.trackId === currentTrackId() && playing()) {
                  <div class="eq" aria-hidden="true"><span></span><span></span><span></span></div>
                }
              </div>
              <div class="queue-artist-row">
                <div class="queue-artist">{{ q.artist }}</div>
                @if (queueSource() !== 'history' && q.duration != null) {
                  <span class="queue-dur">{{ formatTime(q.duration) }}</span>
                }
              </div>
            </div>
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './queue-sheet.component.css',
  host: {
    '[class.queue-reordering]': 'reorderTrackId() !== null',
  },
})
export class QueueSheetComponent {
  private readonly player = inject(PlayerService);

  readonly currentTrackId = input.required<string>();
  readonly playing = input(false);

  readonly queue = toSignal(this.player.queue$, { initialValue: [] as PlayerTrack[] });
  readonly queueSource = toSignal(this.player.queueSource$, {
    initialValue: 'unknown' as QueueSource,
  });

  /** trackId of the grabbed row while reordering, null otherwise. */
  readonly reorderTrackId = signal<string | null>(null);

  private readonly rowWraps = viewChildren<ElementRef<HTMLElement>>('queueRowWrap');

  formatTime(sec: number): string {
    return formatDurationClock(sec);
  }

  play(track: PlayerTrack): void {
    this.player.play(track);
  }

  onGripMouseDown(ev: MouseEvent, startIndex: number): void {
    if (ev.button !== 0) {
      return;
    }
    const row = this.queue()[startIndex];
    if (!row) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    this.reorderTrackId.set(row.trackId);
    document.body.style.userSelect = 'none';
    this.reorderToPointer(ev.clientY);
  }

  @HostListener('window:mousemove', ['$event'])
  onWindowMousemove(ev: MouseEvent): void {
    if (this.reorderTrackId() === null) {
      return;
    }
    this.reorderToPointer(ev.clientY);
  }

  @HostListener('window:mouseup')
  onWindowMouseup(): void {
    if (this.reorderTrackId() === null) {
      return;
    }
    this.reorderTrackId.set(null);
    document.body.style.userSelect = '';
  }

  private reorderToPointer(clientY: number): void {
    const tid = this.reorderTrackId();
    if (!tid) {
      return;
    }
    const q = this.queue();
    const rows = this.rowWraps().map((r) => r.nativeElement);
    if (!q.length || !rows.length) {
      return;
    }
    const fromIdx = q.findIndex((t) => t.trackId === tid);
    if (fromIdx < 0) {
      return;
    }
    const targetIdx = this.insertIndexFromPointerY(clientY, rows);
    if (fromIdx !== targetIdx) {
      this.player.moveQueueItem(fromIdx, targetIdx);
    }
  }

  /** Row index whose vertical midpoint the cursor is inside (drops before midpoint at i). */
  private insertIndexFromPointerY(y: number, rows: HTMLElement[]): number {
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
}
