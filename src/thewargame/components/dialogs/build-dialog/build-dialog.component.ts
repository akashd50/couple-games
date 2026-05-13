import { ChangeDetectionStrategy, Component, HostListener, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  buildDays,
  buildMoneyCost,
  buildResourceCost,
  hubCatalog,
  hubSpec,
  regionEligibleForHub,
} from '../../../data/hubs';
import { RESOURCE_KINDS, RESOURCE_LABELS } from '../../../models/game.types';
import type {
  HubKind,
  RegionState,
  ResourceBag,
  ResourceKind,
} from '../../../models/game.types';
import { ClockService } from '../../../services/clock.service';
import { ConstructionService } from '../../../services/construction.service';
import { DialogsService } from '../../../services/dialogs.service';
import { GameService } from '../../../services/game.service';
import { MapService } from '../../../services/map.service';
import { HubIconComponent } from '../../hud/hub-icon/hub-icon.component';

interface ResCostRow {
  readonly key: ResourceKind;
  readonly label: string;
  readonly value: string;
}

interface BonusRow {
  readonly resource: ResourceKind;
  readonly label: string;
  readonly perLevel: string;
}

interface CatalogEntry {
  readonly kind: HubKind;
  readonly name: string;
  readonly description: string;
  readonly moneyCost: number;
  readonly days: number;
  readonly eligible: boolean;
  readonly reason?: string;
  readonly resourceCost: ResourceCost;
  readonly bonuses: BonusRow[];
}

interface ResourceCost {
  readonly rows: ResCostRow[];
  readonly any: boolean;
}

@Component({
  selector: 'wg-build-dialog',
  standalone: true,
  imports: [DecimalPipe, HubIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './build-dialog.component.html',
  styleUrl: './build-dialog.component.scss',
})
export class BuildDialogComponent {
  private readonly dialogs = inject(DialogsService);
  private readonly game = inject(GameService);
  private readonly construction = inject(ConstructionService);
  private readonly map = inject(MapService);
  private readonly clock = inject(ClockService);

  readonly state = this.dialogs.buildDialog;

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

  readonly catalogEntries = computed<CatalogEntry[]>(() => {
    const region = this.region();
    if (!region) return [];
    return hubCatalog().map((spec) => {
      const elig = regionEligibleForHub(spec.kind, region.baseYields);
      return {
        kind: spec.kind,
        name: spec.name,
        description: spec.description,
        moneyCost: buildMoneyCost(spec.kind, 1),
        days: buildDays(spec.kind, 1),
        eligible: elig.ok,
        reason: elig.reason,
        resourceCost: this.formatResourceCost(buildResourceCost(spec.kind, 1)),
        bonuses: this.bonusRowsFor(spec.kind),
      };
    });
  });

  readonly playerMoney = computed<number>(() => this.game.playerNation()?.money ?? 0);

  isAffordable(entry: CatalogEntry): boolean {
    if (entry.moneyCost > this.playerMoney()) return false;
    const me = this.game.playerNation();
    if (!me) return false;
    for (const k of RESOURCE_KINDS) {
      const need = this.numericCost(entry, k);
      if (need > me.stockpiles[k]) return false;
    }
    return true;
  }

  confirmBuild(entry: CatalogEntry): void {
    const state = this.state();
    const region = this.region();
    if (!state || !region) return;
    const order = this.construction.build(
      region,
      entry.kind,
      state.slotIndex,
      this.clock.day(),
      this.clock.date(),
    );
    if (order) this.dialogs.closeBuild();
  }

  close(): void {
    this.dialogs.closeBuild();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.state()) this.close();
  }

  private numericCost(entry: CatalogEntry, k: ResourceKind): number {
    for (const row of entry.resourceCost.rows) {
      if (row.key === k) return Number(row.value) || 0;
    }
    return 0;
  }

  private bonusRowsFor(kind: HubKind): BonusRow[] {
    const spec = hubSpec(kind);
    const out: BonusRow[] = [];
    for (const k of RESOURCE_KINDS) {
      const v = spec.yieldBonusPerLevel[k];
      if (v) out.push({ resource: k, label: RESOURCE_LABELS[k], perLevel: `+${Math.round(v * 100)}%` });
    }
    return out;
  }

  private formatResourceCost(bag: ResourceBag): ResourceCost {
    const rows: ResCostRow[] = [];
    for (const k of RESOURCE_KINDS) {
      if (bag[k] > 0) {
        rows.push({ key: k, label: RESOURCE_LABELS[k], value: bag[k].toFixed(1) });
      }
    }
    return { rows, any: rows.length > 0 };
  }
}
