import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    ViewChild,
    computed,
    inject,
    signal, isDevMode,
} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {ReactiveFormsModule, FormControl} from '@angular/forms';
import {hubSpec} from '../../../data/hubs';
import {RESOURCE_KINDS, RESOURCE_LABELS} from '../../../models/game.types';
import type {HubKind, ResourceKind} from '../../../models/game.types';
import {ConstructionService} from '../../../services/construction.service';
import {DialogsService} from '../../../services/dialogs.service';
import {GameService} from '../../../services/game.service';
import {IntelService} from '../../../services/intel.service';
import {MapService} from '../../../services/map.service';
import {ResearchService} from '../../../services/research.service';
import {ResourceService} from '../../../services/resource.service';
import {DebugPanelComponent} from "../debug-panel/debug-panel.component";

type Tab = 'resources' | 'agencies' | 'tech' | 'military' | 'dev';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
    {id: 'resources', label: 'Resources'},
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

    constructor() {
        this.searchControl.valueChanges.subscribe((v) => this.searchValue.set(v ?? ''));
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
