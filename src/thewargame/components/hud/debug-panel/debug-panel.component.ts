import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import { MapService } from '../../../services/map.service';
import { worldToGeo } from '../../../pixi/projection';
import type { Region } from '../../../models/geo.types';

interface ResourceStub {
  readonly population: string;
  readonly oil: number;
  readonly gold: number;
  readonly stability: number;
}

interface RelationStub {
  readonly allies: ReadonlyArray<string>;
  readonly hostiles: ReadonlyArray<string>;
}

const RELATION_POOL = [
  'USA',
  'CAN',
  'GBR',
  'FRA',
  'DEU',
  'RUS',
  'CHN',
  'JPN',
  'BRA',
  'IND',
  'MEX',
  'AUS',
];

@Component({
  selector: 'wg-debug-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debug-panel.component.html',
  styleUrl: './debug-panel.component.scss',
})
export class DebugPanelComponent {
  private readonly map = inject(MapService);

  readonly enabled = isDevMode();

  readonly ready = this.map.ready;
  readonly camera = this.map.cameraState;
  readonly viewport = this.map.viewport;
  readonly pointerScreen = this.map.pointerScreen;
  readonly pointerWorld = this.map.pointerWorld;
  readonly tier = this.map.highlightTier;
  readonly hovered = this.map.hovered;
  readonly selected = this.map.selected;

  readonly pointerGeo = computed(() => {
    const w = this.pointerWorld();
    if (!w) return null;
    return worldToGeo(w.x, w.y);
  });

  readonly hoveredResources = computed(() => stubResources(this.hovered()));
  readonly selectedResources = computed(() => stubResources(this.selected()));
  readonly relations = computed(() => stubRelations(this.hovered() ?? this.selected()));

  formatBBox(r: Region | null): string {
    if (!r) return '—';
    const { minX, minY, maxX, maxY } = r.bbox;
    return `${minX.toFixed(0)},${minY.toFixed(0)} → ${maxX.toFixed(0)},${maxY.toFixed(0)}`;
  }
}

function stubResources(r: Region | null): ResourceStub | null {
  if (!r) return null;
  const h = hashCode(r.id);
  return {
    population: `${(Math.abs(h % 28) + 0.4).toFixed(1)}M`,
    oil: Math.abs((h >>> 4) % 100),
    gold: Math.abs((h >>> 8) % 100),
    stability: 55 + Math.abs((h >>> 12) % 45),
  };
}

function stubRelations(r: Region | null): RelationStub | null {
  if (!r) return null;
  const h = hashCode(r.id);
  const pick = (shift: number) => RELATION_POOL[Math.abs(h >>> shift) % RELATION_POOL.length];
  const allies = unique([pick(0), pick(3)]).filter((c) => c !== r.country);
  const hostiles = unique([pick(6), pick(9)]).filter((c) => c !== r.country && !allies.includes(c));
  return { allies, hostiles };
}

function unique<T>(arr: ReadonlyArray<T>): T[] {
  return Array.from(new Set(arr));
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}
