import { Component } from '@angular/core';

@Component({
  selector: 'sg-trivia',
  imports: [],
  template: `
    <div class="sg-placeholder">
      <h2>Trivia Phase</h2>
      <p>Ask questions on your call. Winner gets power-up points.</p>
    </div>
  `,
  styles: [`
    .sg-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--sg-muted, #888);
    }
  `],
})
export class TriviaComponent {}
