import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MapService } from '../../../services/map.service';

interface StubStats {
  readonly population: string;
  readonly oil: number;
  readonly gold: number;
  readonly stability: number;
}

@Component({
  selector: 'wg-region-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './region-tooltip.component.html',
  styleUrl: './region-tooltip.component.scss',
})
export class RegionTooltipComponent {
  private readonly map = inject(MapService);

  readonly hovered = this.map.hovered;
  readonly pointer = this.map.pointerScreen;

  readonly transform = computed<string | null>(() => {
    const p = this.pointer();
    if (!p) return null;
    return `translate(${p.x + 14}px, ${p.y + 14}px)`;
  });

  readonly stats = computed<StubStats | null>(() => {
    const r = this.hovered();
    if (!r) return null;
    const h = hashCode(r.id);
    return {
      population: `${(Math.abs(h % 28) + 0.4).toFixed(1)}M`,
      oil: Math.abs((h >>> 4) % 100),
      gold: Math.abs((h >>> 8) % 100),
      stability: 55 + Math.abs((h >>> 12) % 45),
    };
  });
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
