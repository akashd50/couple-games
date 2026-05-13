import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { HubKind } from '../../../models/game.types';

@Component({
  selector: 'wg-hub-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (kind) {
        @case ('refinery') {
          <rect x="6" y="5" width="12" height="15" rx="1"></rect>
          <line x1="6" y1="10" x2="18" y2="10"></line>
          <line x1="6" y1="15" x2="18" y2="15"></line>
          <line x1="10" y1="5" x2="10" y2="3"></line>
          <line x1="14" y1="5" x2="14" y2="3"></line>
        }
        @case ('mine') {
          <polygon points="12,4 22,20 2,20"></polygon>
          <polyline points="7,20 12,13 17,20"></polyline>
        }
        @case ('research_lab') {
          <line x1="9" y1="3" x2="15" y2="3"></line>
          <path d="M10 3v5l-5 11a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-11V3"></path>
          <line x1="7.5" y1="14" x2="16.5" y2="14"></line>
        }
        @case ('intel_agency') {
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        }
        @case ('defense_plant') {
          <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"></path>
          <polyline points="9,12 11.5,14.5 16,10"></polyline>
        }
      }
    </svg>
  `,
})
export class HubIconComponent {
  @Input({ required: true }) kind!: HubKind;
  @Input() size = 18;
}
