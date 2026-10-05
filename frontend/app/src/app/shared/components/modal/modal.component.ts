import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div
        class="backdrop"
        role="button"
        tabindex="0"
        aria-label="close"
        (click)="onBackdrop()"
        (keydown.escape)="onBackdrop()"
      ></div>
      <div class="dialog-wrap" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="dialog">
          <h2 class="title" id="modal-title">{{ title() }}</h2>
          <div class="body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './modal.component.css',
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly isOpen = input(false);
  readonly closed = output<void>();

  onBackdrop(): void {
    this.closed.emit();
  }
}
