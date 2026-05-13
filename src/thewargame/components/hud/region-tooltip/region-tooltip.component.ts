import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MapService } from '../../../services/map.service';
import { GameService } from '../../../services/game.service';
import { ResourceService } from '../../../services/resource.service';
import type { Region } from '../../../models/geo.types';
import type { RegionState } from '../../../models/game.types';

interface RegionStats {
  readonly population: string;
  readonly oil: string;
  readonly gold: string;
  readonly stability: number;
  readonly scope: 'subdivision' | 'country';
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
  private readonly game = inject(GameService);
  private readonly resources = inject(ResourceService);

  readonly hovered = this.map.hovered;
  readonly pointer = this.map.pointerScreen;

  readonly transform = computed<string | null>(() => {
    const p = this.pointer();
    if (!p) return null;
    return `translate(${p.x + 14}px, ${p.y + 14}px)`;
  });

  readonly stats = computed<RegionStats | null>(() => {
    const r = this.hovered();
    if (!r) return null;
    return this.buildStats(r);
  });

  private buildStats(r: Region): RegionStats | null {
    if (r.kind === 'subdivision') {
      const state = this.game.getRegion(r.id);
      if (!state) return null;
      return this.statsFromRegion(state, 'subdivision');
    }
    // Country tier: aggregate owned subdivisions if this country is a tracked nation.
    const nation = this.game.getNation(r.id);
    if (!nation) return null;
    const owned: RegionState[] = [];
    for (const id of nation.regionIds) {
      const s = this.game.getRegion(id);
      if (s) owned.push(s);
    }
    if (owned.length === 0) return null;
    const aggregate = aggregateRegions(owned);
    let oil = 0;
    let gold = 0;
    for (const s of owned) {
      oil += this.resources.yieldFor(s, 'oil');
      gold += this.resources.yieldFor(s, 'gold');
    }
    return {
      population: `${aggregate.population.toFixed(1)}M`,
      oil: oil.toFixed(1),
      gold: gold.toFixed(2),
      stability: Math.round(aggregate.stability),
      scope: 'country',
    };
  }

  private statsFromRegion(s: RegionState, scope: 'subdivision' | 'country'): RegionStats {
    const oil = this.resources.yieldFor(s, 'oil');
    const gold = this.resources.yieldFor(s, 'gold');
    return {
      population: `${s.population.toFixed(1)}M`,
      oil: oil.toFixed(2),
      gold: gold.toFixed(3),
      stability: Math.round(s.stability),
      scope,
    };
  }
}

function aggregateRegions(regions: ReadonlyArray<RegionState>): {
  readonly population: number;
  readonly stability: number;
} {
  let pop = 0;
  let stab = 0;
  for (const r of regions) {
    pop += r.population;
    stab += r.stability;
  }
  return {
    population: pop,
    stability: regions.length ? stab / regions.length : 0,
  };
}
