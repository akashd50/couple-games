import { Component } from '@angular/core';

@Component({
  selector: 'sg-battle',
  imports: [],
  template: `
    <div class="sg-placeholder">
      <h2>Battle Phase</h2>
      <p>Slingshot at the opponent's heart! Use power-ups wisely.</p>
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
export class BattleComponent {}
