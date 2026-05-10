import { Component } from '@angular/core';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-mood',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="page">
      <h1>{{ 'tags' | t }}</h1>
      <p class="hint">{{ 'moodComing' | t }}</p>
    </div>
  `,
  styles: `
    .page {
      padding: 2rem;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .hint {
      color: var(--accent-dim);
    }
  `,
})
export class MoodComponent {}
