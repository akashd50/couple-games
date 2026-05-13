import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    ViewChild,
    computed,
    effect,
    inject,
    signal, isDevMode,
} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {ReactiveFormsModule, FormControl} from '@angular/forms';
import {buildDays, buildMoneyCost, hubSpec} from '../../../data/hubs';
import {RESOURCE_KINDS, RESOURCE_LABELS} from '../../../models/game.types';
import type {Hub, HubKind, RegionState, ResourceKind} from '../../../models/game.types';
import {ConstructionService} from '../../../services/construction.service';
import {DialogsService} from '../../../services/dialogs.service';
import {GameService} from '../../../services/game.service';
import {IntelService} from '../../../services/intel.service';
import {MapService} from '../../../services/map.service';
import {ResearchService} from '../../../services/research.service';
import {ResourceService} from '../../../services/resource.service';
import {DebugPanelComponent} from "../debug-panel/debug-panel.component";

type Tab = 'resources' | 'build' | 'agencies' | 'tech' | 'military' | 'dev';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
    {id: 'resources', label: 'Resources'},
    {id: 'build', label: 'Build'},
    {id: 'agencies', label: 'Agencies'},
    {id: 'tech', label: 'Tech'},
    {id: 'military', label: 'Military'},
];

const DEV_TAB: { id: Tab; label: string } = {id: 'dev', label: 'Dev'};

interface ResourceRow {
    readonly key: ResourceKind;
    readonly label: string;
    readonly stockpile: string;
    readonly yield: string;
    readonly price: string;
}

interface RegionSearchResult {
    readonly id: string;
    readonly name: string;
    readonly hubCount: number;
    readonly slots: number;
}

interface AgencyRow {
    readonly id: string;
    readonly name: string;
    readonly nationId: string;
    readonly coverage: number;
    readonly focused: boolean;
}

interface HubSummaryRow {
    readonly kind: HubKind;
    readonly label: string;
    readonly count: number;
    readonly totalLevel: number;
}

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
    selector: 'wg-side-panel',
    standalone: true,
    imports: [DecimalPipe, ReactiveFormsModule, DebugPanelComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './side-panel.component.html',
    styleUrl: './side-panel.component.scss',
})
export class SidePanelComponent {
    private readonly game = inject(GameService);
    private readonly resources = inject(ResourceService);
    private readonly construction = inject(ConstructionService);
    private readonly research = inject(ResearchService);
    private readonly intel = inject(IntelService);
    private readonly map = inject(MapService);
    private readonly dialogs = inject(DialogsService);

    readonly tabs = isDevMode() ? [DEV_TAB, ...TABS] : TABS;
    readonly activeTab = signal<Tab>('resources');

    readonly searchControl = new FormControl<string>('', {nonNullable: true});
    readonly searchValue = signal('');

    @ViewChild('searchInput')
    private searchInput?: ElementRef<HTMLInputElement>;

    readonly playerNation = this.game.playerNation;
    readonly playerRegions = this.game.playerRegions;
    readonly playerDailyIncome = this.game.playerDailyIncome;
    readonly playerDailyYield = this.game.playerDailyYield;
    readonly prices = this.resources.prices;
    readonly playerOrders = this.construction.playerOrders;
    readonly researchPoints = this.research.points;
    readonly researchRate = this.research.rate;
    readonly unlockedTech = this.research.unlocked;
    readonly intelCoverage = this.intel.coverage;
    readonly focusedRegion = this.intel.focusedRegion;
    readonly foreignNations = this.game.foreignNations;

    readonly resourceRows = computed<ResourceRow[]>(() => {
        const me = this.playerNation();
        const yields = this.playerDailyYield();
        const prices = this.prices();
        return RESOURCE_KINDS.map((k) => ({
            key: k,
            label: RESOURCE_LABELS[k],
            stockpile: me ? me.stockpiles[k].toFixed(0) : '—',
            yield: yields[k].toFixed(2),
            price: `$${prices[k].toFixed(2)}`,
        }));
    });

    readonly searchResults = computed<RegionSearchResult[]>(() => {
        const q = this.searchValue().trim().toLowerCase();
        if (q.length < 1) return [];
        const me = this.playerNation();
        if (!me) return [];
        const out: RegionSearchResult[] = [];
        const regions = this.game.regions();
        for (const id of me.regionIds) {
            const r = regions.get(id);
            if (!r) continue;
            const geo = this.map.getRegion(id);
            const name = (geo?.name ?? id).toLowerCase();
            if (!name.includes(q) && !id.toLowerCase().includes(q)) continue;
            out.push({
                id,
                name: geo?.name ?? id,
                hubCount: r.hubs.length,
                slots: r.slots,
            });
            if (out.length >= 8) break;
        }
        return out;
    });

    readonly agencyRows = computed<AgencyRow[]>(() => {
        const out: AgencyRow[] = [];
        const regions = this.game.regions();
        const focus = this.focusedRegion();
        for (const nation of this.foreignNations()) {
            for (const id of nation.regionIds) {
                const r = regions.get(id);
                if (!r) continue;
                const geo = this.map.getRegion(id);
                out.push({
                    id,
                    name: geo?.name ?? id,
                    nationId: nation.id,
                    coverage: this.intel.getCoverage(id),
                    focused: focus === id,
                });
            }
        }
        return out;
    });

    readonly hubSummaryRows = computed<HubSummaryRow[]>(() => {
        const map = new Map<HubKind, HubSummaryRow>();
        for (const r of this.playerRegions()) {
            for (const h of r.hubs) {
                const row = map.get(h.kind) ?? {
                    kind: h.kind,
                    label: hubSpec(h.kind).name,
                    count: 0,
                    totalLevel: 0,
                };
                map.set(h.kind, {...row, count: row.count + 1, totalLevel: row.totalLevel + h.level});
            }
        }
        return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
    });

    readonly totalSlots = computed<{ filled: number; total: number }>(() => {
        let filled = 0;
        let total = 0;
        for (const r of this.playerRegions()) {
            total += r.slots;
            filled += r.hubs.length;
        }
        return {filled, total};
    });

    readonly availableTech = computed(() =>
        this.research.tree.map((node) => ({
            node,
            unlocked: this.unlockedTech().has(node.id),
            can: this.research.canUnlock(node.id),
        })),
    );

    readonly selectedRegion = this.map.selected;

    readonly buildRegionState = computed<RegionState | null>(() => {
        const r = this.selectedRegion();
        if (!r || r.kind !== 'subdivision') return null;
        const state = this.game.getRegion(r.id);
        if (!state) return null;
        if (state.nationId !== this.game.playerNationId()) return null;
        return state;
    });

    readonly buildRegionName = computed<string>(() => this.selectedRegion()?.name ?? '—');

    readonly pendingUpgrades = computed<ReadonlyMap<string, number>>(() => {
        const state = this.buildRegionState();
        if (!state) return new Map();
        const out = new Map<string, number>();
        for (const o of this.construction.ordersFor(state.id)) {
            if (o.hubId !== undefined) out.set(o.hubId, o.targetLevel);
        }
        return out;
    });

    readonly slotRows = computed<SlotRow[]>(() => {
        const state = this.buildRegionState();
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

    readonly yieldRows = computed<YieldRow[]>(() => {
        const state = this.buildRegionState();
        if (!state) return [];
        return RESOURCE_KINDS.map((k) => ({
            key: k,
            label: RESOURCE_LABELS[k],
            base: state.baseYields[k].toFixed(2),
            effective: this.resources.yieldFor(state, k).toFixed(2),
        }));
    });

    private prevSelectedId: string | null = null;

    constructor() {
        this.searchControl.valueChanges.subscribe((v) => this.searchValue.set(v ?? ''));

        // Auto-switch to the Build tab when the player selects one of their
        // subdivisions. Only fires on transitions (not while clicking around
        // inside the same region) so the user can freely browse other tabs.
        effect(() => {
            const r = this.selectedRegion();
            const id = r?.id ?? null;
            if (id && id !== this.prevSelectedId && r?.kind === 'subdivision') {
                const state = this.game.getRegion(id);
                if (state?.nationId === this.game.playerNationId()) {
                    this.activeTab.set('build');
                }
            }
            this.prevSelectedId = id;
        });
    }

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
        const state = this.buildRegionState();
        if (!state) return;
        this.dialogs.openNewBuild(state.id, slotIndex);
    }

    openUpgrade(hub: Hub): void {
        const state = this.buildRegionState();
        if (!state) return;
        this.dialogs.openUpgrade(state.id, hub.id);
    }

    clearRegionSelection(): void {
        this.map.clearSelection();
    }

    setTab(t: Tab): void {
        this.activeTab.set(t);
    }

    cycleTab(direction: 1 | -1): void {
        const idx = TABS.findIndex((t) => t.id === this.activeTab());
        const next = (idx + direction + TABS.length) % TABS.length;
        this.activeTab.set(TABS[next].id);
    }

    pickSearchResult(r: RegionSearchResult): void {
        this.searchControl.setValue('');
        this.searchValue.set('');
        this.map.selectRegionById(r.id);
    }

    openTechTree(): void {
        this.dialogs.openTech();
    }

    setIntelFocus(regionId: string): void {
        const current = this.focusedRegion();
        this.intel.setFocus(current === regionId ? null : regionId);
    }

    spendIntel(regionId: string, dollars: number): void {
        void this.intel.spend(regionId, dollars, new Date());
    }

    focusSearch(): void {
        this.searchInput?.nativeElement.focus();
    }

    hubShortLabel(kind: HubKind): string {
        return hubSpec(kind).short;
    }

    @HostListener('document:keydown', ['$event'])
    onKey(e: KeyboardEvent): void {
        if (isTypingTarget(e.target)) return;
        if (e.key === '/') {
            e.preventDefault();
            this.focusSearch();
        }
    }
}

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return (
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
    );
}
