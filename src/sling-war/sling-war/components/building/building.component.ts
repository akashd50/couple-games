import { Component } from '@angular/core';

@Component({
  selector: 'sg-building',
  imports: [],
  template: `
    <div class="sg-placeholder">
      <h2>Building Phase</h2>
      <p>Drag blocks to build your fortress. Opponent builds on their side.</p>
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
export class BuildingComponent {}
