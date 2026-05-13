import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { buildDays, buildMoneyCost, hubSpec } from '../../../data/hubs';
import { RESOURCE_KINDS, RESOURCE_LABELS } from '../../../models/game.types';
import type { Hub, RegionState, ResourceKind } from '../../../models/game.types';
import { ConstructionService } from '../../../services/construction.service';
import { DialogsService } from '../../../services/dialogs.service';
import { GameService } from '../../../services/game.service';
import { MapService } from '../../../services/map.service';
import { ResourceService } from '../../../services/resource.service';

interface SlotRow {
  readonly index: number;
  readonly hub: Hub | null;
  readonly pendingLabel: string | null;
}

interface YieldRow {
  readonly key: ResourceKind;
  readonly label: string;
  readonly base: string;
  readonly effective: string;
}

@Component({
  selector: 'wg-region-drawer',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './region-drawer.component.html',
  styleUrl: './region-drawer.component.scss',
})
export class RegionDrawerComponent {
  private readonly game = inject(GameService);
  private readonly map = inject(MapService);
  private readonly construction = inject(ConstructionService);
  private readonly dialogs = inject(DialogsService);
  private readonly resources = inject(ResourceService);

  readonly selectedRegion = this.map.selected;
  readonly playerNationId = this.game.playerNationId;

  /** The active region's sim state if it's a player-owned subdivision. */
  readonly regionState = computed<RegionState | null>(() => {
    const r = this.selectedRegion();
    if (!r || r.kind !== 'subdivision') return null;
    const state = this.game.getRegion(r.id);
    if (!state) return null;
    if (state.nationId !== this.playerNationId()) return null;
    return state;
  });

  readonly regionName = computed<string>(() => {
    const r = this.selectedRegion();
    return r?.name ?? '—';
  });

  readonly slotRows = computed<SlotRow[]>(() => {
    const state = this.regionState();
    if (!state) return [];
    const orders = this.construction.ordersFor(state.id);
    const pendingByIdx = new Map<number, string>();
    for (const o of orders) {
      if (o.slotIndex !== undefined) {
        pendingByIdx.set(o.slotIndex, `${hubSpec(o.hubKind).short} L${o.targetLevel} pending`);
      }
    }
    const hubBySlot = new Map<number, Hub>();
    for (const h of state.hubs) hubBySlot.set(h.slotIndex, h);
    const rows: SlotRow[] = [];
    for (let i = 0; i < state.slots; i++) {
      rows.push({
        index: i,
        hub: hubBySlot.get(i) ?? null,
        pendingLabel: pendingByIdx.get(i) ?? null,
      });
    }
    return rows;
  });

  readonly pendingUpgrades = computed<ReadonlyMap<string, number>>(() => {
    const state = this.regionState();
    if (!state) return new Map();
    const out = new Map<string, number>();
    for (const o of this.construction.ordersFor(state.id)) {
      if (o.hubId !== undefined) out.set(o.hubId, o.targetLevel);
    }
    return out;
  });

  readonly yieldRows = computed<YieldRow[]>(() => {
    const state = this.regionState();
    if (!state) return [];
    return RESOURCE_KINDS.map((k) => ({
      key: k,
      label: RESOURCE_LABELS[k],
      base: state.baseYields[k].toFixed(2),
      effective: this.resources.yieldFor(state, k).toFixed(2),
    }));
  });

  hubName(hub: Hub): string {
    return hubSpec(hub.kind).name;
  }

  hubShort(hub: Hub): string {
    return hubSpec(hub.kind).short;
  }

  hubMaxLevel(hub: Hub): number {
    return hubSpec(hub.kind).maxLevel;
  }

  upgradeCost(hub: Hub): number {
    return buildMoneyCost(hub.kind, hub.level + 1);
  }

  upgradeDays(hub: Hub): number {
    return buildDays(hub.kind, hub.level + 1);
  }

  pendingUpgradeLevel(hub: Hub): number | null {
    return this.pendingUpgrades().get(hub.id) ?? null;
  }

  openBuild(slotIndex: number): void {
    const state = this.regionState();
    if (!state) return;
    this.dialogs.openNewBuild(state.id, slotIndex);
  }

  openUpgrade(hub: Hub): void {
    const state = this.regionState();
    if (!state) return;
    this.dialogs.openUpgrade(state.id, hub.id);
  }

  close(): void {
    this.map.clearSelection();
  }
}
