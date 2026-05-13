import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  buildDays,
  buildMoneyCost,
  buildResourceCost,
  hubSpec,
} from '../../../data/hubs';
import { RESOURCE_KINDS, RESOURCE_LABELS } from '../../../models/game.types';
import type {
  BuildOrder,
  Hub,
  RegionState,
  ResourceBag,
  ResourceKind,
} from '../../../models/game.types';
import { ClockService } from '../../../services/clock.service';
import { ConstructionService } from '../../../services/construction.service';
import { DialogsService } from '../../../services/dialogs.service';
import { GameService } from '../../../services/game.service';
import { MapService } from '../../../services/map.service';
import { ResourceService } from '../../../services/resource.service';
import { HubIconComponent } from '../../hud/hub-icon/hub-icon.component';

interface ResCostRow {
  readonly key: ResourceKind;
  readonly label: string;
  readonly value: string;
}

interface YieldDeltaRow {
  readonly key: ResourceKind;
  readonly label: string;
  readonly current: string;
  readonly next: string;
  readonly delta: string;
}

interface UpgradePlan {
  readonly targetLevel: number;
  readonly money: number;
  readonly days: number;
  readonly resourceCost: ReadonlyArray<ResCostRow>;
  readonly deltas: ReadonlyArray<YieldDeltaRow>;
  readonly affordable: boolean;
  readonly atMax: boolean;
  readonly pendingLevel: number | null;
}

@Component({
  selector: 'wg-hub-info-dialog',
  standalone: true,
  imports: [DecimalPipe, HubIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub-info-dialog.component.html',
  styleUrl: './hub-info-dialog.component.scss',
})
export class HubInfoDialogComponent {
  private readonly dialogs = inject(DialogsService);
  private readonly game = inject(GameService);
  private readonly map = inject(MapService);
  private readonly clock = inject(ClockService);
  private readonly construction = inject(ConstructionService);
  private readonly resources = inject(ResourceService);

  readonly state = this.dialogs.hubInfoDialog;
  readonly clockDay = this.clock.day;

  readonly region = computed<RegionState | null>(() => {
    const s = this.state();
    if (!s) return null;
    return this.game.getRegion(s.regionId);
  });

  readonly regionName = computed<string>(() => {
    const s = this.state();
    if (!s) return '';
    return this.map.getRegion(s.regionId)?.name ?? s.regionId;
  });

  readonly hub = computed<Hub | null>(() => {
    const s = this.state();
    const r = this.region();
    if (!s || !r) return null;
    return r.hubs.find((h) => h.id === s.hubId) ?? null;
  });

  readonly hubName = computed(() => {
    const h = this.hub();
    return h ? hubSpec(h.kind).name : '';
  });

  readonly hubDescription = computed(() => {
    const h = this.hub();
    return h ? hubSpec(h.kind).description : '';
  });

  readonly pendingOrder = computed<BuildOrder | null>(() => {
    const h = this.hub();
    const r = this.region();
    if (!h || !r) return null;
    return this.construction.ordersFor(r.id).find((o) => o.hubId === h.id) ?? null;
  });

  /** Per-resource current contribution from THIS hub (multiplier delta vs. base). */
  readonly currentContributions = computed<ReadonlyArray<{ key: ResourceKind; label: string; pct: string }>>(() => {
    const h = this.hub();
    if (!h) return [];
    const spec = hubSpec(h.kind);
    const out: { key: ResourceKind; label: string; pct: string }[] = [];
    for (const k of RESOURCE_KINDS) {
      const v = spec.yieldBonusPerLevel[k];
      if (v) out.push({ key: k, label: RESOURCE_LABELS[k], pct: `+${Math.round(v * h.level * 100)}%` });
    }
    return out;
  });

  readonly upgradePlan = computed<UpgradePlan | null>(() => {
    const h = this.hub();
    const r = this.region();
    if (!h || !r) return null;
    const spec = hubSpec(h.kind);
    const atMax = h.level >= spec.maxLevel;
    const pending = this.pendingOrder();
    if (atMax) {
      return {
        targetLevel: h.level,
        money: 0,
        days: 0,
        resourceCost: [],
        deltas: [],
        affordable: false,
        atMax: true,
        pendingLevel: pending?.targetLevel ?? null,
      };
    }
    const target = h.level + 1;
    const money = buildMoneyCost(h.kind, target);
    const days = buildDays(h.kind, target);
    const resourceCost = this.formatResourceCost(buildResourceCost(h.kind, target));
    const deltas = this.yieldDeltaRows(r, h, target);
    return {
      targetLevel: target,
      money,
      days,
      resourceCost,
      deltas,
      affordable: this.canAfford(money, buildResourceCost(h.kind, target)),
      atMax: false,
      pendingLevel: pending?.targetLevel ?? null,
    };
  });

  readonly playerMoney = computed<number>(() => this.game.playerNation()?.money ?? 0);

  upgrade(): void {
    const h = this.hub();
    const r = this.region();
    if (!h || !r) return;
    const order = this.construction.upgrade(r, h, this.clock.day(), this.clock.date());
    if (order) this.close();
  }

  close(): void {
    this.dialogs.closeHubInfo();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.state()) this.close();
  }

  private canAfford(money: number, cost: ResourceBag): boolean {
    const me = this.game.playerNation();
    if (!me) return false;
    if (me.money < money) return false;
    for (const k of RESOURCE_KINDS) {
      if ((cost[k] ?? 0) > me.stockpiles[k]) return false;
    }
    return true;
  }

  private formatResourceCost(bag: ResourceBag): ResCostRow[] {
    const out: ResCostRow[] = [];
    for (const k of RESOURCE_KINDS) {
      if (bag[k] > 0) out.push({ key: k, label: RESOURCE_LABELS[k], value: bag[k].toFixed(1) });
    }
    return out;
  }

  private yieldDeltaRows(region: RegionState, hub: Hub, nextLevel: number): YieldDeltaRow[] {
    const spec = hubSpec(hub.kind);
    const out: YieldDeltaRow[] = [];
    for (const k of RESOURCE_KINDS) {
      const v = spec.yieldBonusPerLevel[k];
      if (!v) continue;
      const current = this.resources.yieldFor(region, k);
      // Project effective yield with this hub bumped to nextLevel.
      const simulated: RegionState = {
        ...region,
        hubs: region.hubs.map((h) => (h.id === hub.id ? { ...h, level: nextLevel } : h)),
      };
      const next = this.resources.yieldFor(simulated, k);
      out.push({
        key: k,
        label: RESOURCE_LABELS[k],
        current: current.toFixed(2),
        next: next.toFixed(2),
        delta: `+${(next - current).toFixed(2)}`,
      });
    }
    return out;
  }
}
