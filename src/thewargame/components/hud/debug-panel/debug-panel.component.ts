import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import { MapService } from '../../../services/map.service';
import { GameService } from '../../../services/game.service';
import { ResourceService } from '../../../services/resource.service';
import { ClockService } from '../../../services/clock.service';
import { worldToGeo } from '../../../pixi/projection';
import { RESOURCE_KINDS, RESOURCE_LABELS } from '../../../models/game.types';
import type { Region } from '../../../models/geo.types';
import type { Nation, RegionState, ResourceKind } from '../../../models/game.types';

interface ResourceRow {
  readonly key: ResourceKind;
  readonly label: string;
  readonly value: string;
}

interface RelationRow {
  readonly id: string;
  readonly value: number;
}

@Component({
  selector: 'wg-debug-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './debug-panel.component.html',
  styleUrl: './debug-panel.component.scss',
})
export class DebugPanelComponent {
  private readonly map = inject(MapService);
  private readonly game = inject(GameService);
  private readonly resources = inject(ResourceService);
  private readonly clock = inject(ClockService);

  readonly enabled = isDevMode();

  readonly ready = this.map.ready;
  readonly camera = this.map.cameraState;
  readonly viewport = this.map.viewport;
  readonly pointerScreen = this.map.pointerScreen;
  readonly pointerWorld = this.map.pointerWorld;
  readonly tier = this.map.highlightTier;
  readonly hovered = this.map.hovered;
  readonly selected = this.map.selected;

  readonly day = this.clock.day;
  readonly speed = this.clock.speed;
  readonly paused = this.clock.paused;

  readonly playerNation = this.game.playerNation;
  readonly foreignNations = this.game.foreignNations;
  readonly prices = this.resources.prices;

  readonly pointerGeo = computed(() => {
    const w = this.pointerWorld();
    if (!w) return null;
    return worldToGeo(w.x, w.y);
  });

  readonly hoveredState = computed(() => this.regionStateFor(this.hovered()));
  readonly selectedState = computed(() => this.regionStateFor(this.selected()));

  readonly hoveredYields = computed<ResourceRow[] | null>(() => {
    const s = this.hoveredState();
    if (!s) return null;
    return RESOURCE_KINDS.map((k) => ({
      key: k,
      label: RESOURCE_LABELS[k],
      value: this.resources.yieldFor(s, k).toFixed(3),
    }));
  });

  readonly playerStockpiles = computed<ResourceRow[] | null>(() => {
    const n = this.playerNation();
    if (!n) return null;
    return RESOURCE_KINDS.map((k) => ({
      key: k,
      label: RESOURCE_LABELS[k],
      value: n.stockpiles[k].toFixed(1),
    }));
  });

  readonly priceRows = computed<ResourceRow[]>(() =>
    RESOURCE_KINDS.map((k) => ({
      key: k,
      label: RESOURCE_LABELS[k],
      value: `$${this.prices()[k].toFixed(2)}`,
    })),
  );

  readonly playerRelations = computed<RelationRow[]>(() => {
    const me = this.playerNation();
    if (!me) return [];
    return Object.entries(me.relations).map(([id, value]) => ({ id, value }));
  });

  speedLabel(): string {
    return this.paused() ? 'paused' : `${this.speed()}×`;
  }

  formatBBox(r: Region | null): string {
    if (!r) return '—';
    const { minX, minY, maxX, maxY } = r.bbox;
    return `${minX.toFixed(0)},${minY.toFixed(0)} → ${maxX.toFixed(0)},${maxY.toFixed(0)}`;
  }

  formatMoney(n: Nation | null): string {
    if (!n) return '—';
    return `$${n.money.toFixed(0)}`;
  }

  private regionStateFor(r: Region | null): RegionState | null {
    if (!r) return null;
    if (r.kind !== 'subdivision') return null;
    return this.game.getRegion(r.id);
  }
}
