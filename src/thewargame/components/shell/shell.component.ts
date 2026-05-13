import {
    ChangeDetectionStrategy,
    Component,
    HostListener,
    OnDestroy,
    OnInit,
    effect,
    inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapViewComponent } from '../map-view/map-view.component';
import { ClockBarComponent } from '../hud/clock-bar/clock-bar.component';
import { NewsTickerComponent } from '../hud/news-ticker/news-ticker.component';
import { SidePanelComponent } from '../hud/side-panel/side-panel.component';
import { BuildDialogComponent } from '../dialogs/build-dialog/build-dialog.component';
import { TechTreeDialogComponent } from '../dialogs/tech-tree-dialog/tech-tree-dialog.component';
import { ClockService, formatGameDate } from '../../services/clock.service';
import { AiService } from '../../services/ai.service';
import { ConstructionService } from '../../services/construction.service';
import { DialogsService } from '../../services/dialogs.service';
import { GameService } from '../../services/game.service';
import { IntelService } from '../../services/intel.service';
import { MapService, type SlotInput } from '../../services/map.service';
import type { PendingSlotInfo } from '../../pixi/build-slots';
import { NewsService } from '../../services/news.service';
import { ResearchService } from '../../services/research.service';
import { ResourceService } from '../../services/resource.service';
import { HubInfoDialogComponent } from '../dialogs/hub-info-dialog/hub-info-dialog.component';

@Component({
    selector: 'wg-shell',
    standalone: true,
    imports: [
        RouterLink,
        MapViewComponent,
        ClockBarComponent,
        NewsTickerComponent,
        SidePanelComponent,
        BuildDialogComponent,
        HubInfoDialogComponent,
        TechTreeDialogComponent,
    ],
    providers: [
        MapService,
        ClockService,
        NewsService,
        ResourceService,
        GameService,
        AiService,
        ConstructionService,
        ResearchService,
        IntelService,
        DialogsService,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
    private readonly clock = inject(ClockService);
    private readonly game = inject(GameService);
    private readonly ai = inject(AiService);
    private readonly news = inject(NewsService);
    private readonly map = inject(MapService);
    private readonly construction = inject(ConstructionService);
    private readonly research = inject(ResearchService);
    private readonly intel = inject(IntelService);
    private readonly dialogs = inject(DialogsService);

    constructor() {
        // Sync player regions + pending build orders → map slot indicators
        // (kind + progress). Re-runs each tick (via clock.day signal) so the
        // arc grows smoothly as construction advances.
        effect(() => {
            const mapReady = this.map.ready();
            const playerRegions = this.game.playerRegions();
            const orders = this.construction.orders();
            const currentDay = this.clock.day();
            if (!mapReady) return;
            const pendingByRegion = new Map<string, Map<number, PendingSlotInfo>>();
            for (const o of orders) {
                let slotIndex = o.slotIndex;
                let isUpgrade = false;
                if (slotIndex === undefined && o.hubId !== undefined) {
                    const region = this.game.getRegion(o.regionId);
                    const hub = region?.hubs.find((h) => h.id === o.hubId);
                    if (!hub) continue;
                    slotIndex = hub.slotIndex;
                    isUpgrade = true;
                }
                if (slotIndex === undefined) continue;
                const span = Math.max(1, o.completionDay - o.startDay);
                const progress = Math.max(0, Math.min(1, (currentDay - o.startDay) / span));
                let m = pendingByRegion.get(o.regionId);
                if (!m) {
                    m = new Map();
                    pendingByRegion.set(o.regionId, m);
                }
                m.set(slotIndex, { kind: o.hubKind, progress, isUpgrade });
            }
            const input: SlotInput[] = playerRegions.map((state) => ({
                state,
                pendingBySlotIndex: pendingByRegion.get(state.id) ?? new Map(),
            }));
            this.map.setSlotData(input);
        });

        // When the user clicks a build slot on the map: built hub → info modal;
        // empty + idle → build catalog; pending (slot or hub being upgraded) →
        // suppressed (the progress arc is already telling them the story).
        effect(() => {
            const pick = this.map.slotPicked();
            if (!pick) return;
            const state = this.game.getRegion(pick.regionId);
            if (!state) {
                this.map.clearSlotPicked();
                return;
            }
            const occupied = state.hubs.find((h) => h.slotIndex === pick.slotIndex);
            const orders = this.construction.ordersFor(state.id);
            const slotPending = orders.some(
                (o) => o.slotIndex === pick.slotIndex,
            );
            const hubPending = occupied
                ? orders.some((o) => o.hubId === occupied.id)
                : false;
            if (slotPending) {
                this.map.clearSlotPicked();
                return;
            }
            if (occupied) {
                if (hubPending) {
                    // Still show the info modal so the user can see the building's
                    // stats; the dialog renders the upgrade pending banner itself.
                    this.dialogs.openHubInfo(state.id, occupied.id);
                } else {
                    this.dialogs.openHubInfo(state.id, occupied.id);
                }
            } else {
                this.dialogs.openNewBuild(state.id, pick.slotIndex);
            }
            this.map.clearSlotPicked();
        });
    }

    async ngOnInit(): Promise<void> {
        await this.game.init();
        // Order matters: subscribe construction/research/intel AFTER game so they
        // see post-production state. AI subscribes last for the same reason.
        // See memory/project_thewargame_sim_architecture.md.
        this.construction.init();
        this.research.init();
        this.intel.init();
        this.ai.init();
        const start = formatGameDate(this.clock.date());
        this.news.push({
            date: start,
            category: 'system',
            severity: 'info',
            headline: 'Administration sworn in. Press play to begin.',
        });
    }

    ngOnDestroy(): void {
        this.clock.pause();
    }

    @HostListener('document:keydown', ['$event'])
    onKey(e: KeyboardEvent): void {
        if (isTypingTarget(e.target)) return;
        // Esc closes any open dialog without affecting the clock.
        if (e.key === 'Escape' && this.dialogs.anyOpen()) {
            e.preventDefault();
            this.dialogs.closeAll();
            return;
        }
        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.clock.togglePause();
                break;
            case '1':
                this.clock.setSpeed(1);
                break;
            case '2':
                this.clock.setSpeed(5);
                break;
            case '3':
                this.clock.setSpeed(20);
                break;
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
