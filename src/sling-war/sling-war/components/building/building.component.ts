import {
    Component,
    OnDestroy,
    AfterViewInit,
    ElementRef,
    ViewChild,
    signal,
    effect,
    HostListener, computed
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlingWarStateService } from '../../services/sling-war-state.service';
import { PhysicsService } from '../../services/physics.service';
import { BLOCK_TYPES, getBlockType } from '../../data/block-types';
import type { BlockKind, BlockPlacement, SlingWarGamePlayer } from '../../../game.types';
import { Subscription } from 'rxjs';
import Matter, { Render } from 'matter-js';
import { TestSlingWarStateService } from "../../services/test-sling-war-state.service";
import { WindowSizeService } from "../../services/window-size.service";

@Component({
    selector: 'sg-building',
    imports: [FormsModule],
    templateUrl: 'building.component.html',
    styleUrls: ['./building.component.scss'],
    standalone: true,
})
export class BuildingComponent implements OnDestroy, AfterViewInit {
    @ViewChild('canvas', {static: false}) canvasRef!: ElementRef<HTMLCanvasElement>;

    readonly BLOCK_TYPES = BLOCK_TYPES;
    readonly GRID_X_NUM = 12;
    readonly GRID_Y_NUM = 20;

    GRID_PX = 30;
    canvasWidth = this.GRID_PX * this.GRID_X_NUM;
    canvasHeight = this.GRID_PX * this.GRID_Y_NUM;


    selectedKind = signal<BlockKind | null>(null);
    dragging = signal(false);
    dragWorldX = signal(0);
    dragWorldY = signal(0);

    phase = signal<'waiting' | 'building' | 'trivia' | 'battle' | 'finished' | null>(null);
    myId = signal<string | null>(null);
    player = signal<SlingWarGamePlayer | null>(null);
    p1Layout = signal<BlockPlacement[]>([]);
    p2Layout = signal<BlockPlacement[]>([]);
    p1Ready = signal(false);
    p2Ready = signal(false);
    roomCode = signal<string | null>(null);

    turn = signal<'p1' | 'p2' | null>(null);

    private subscription = new Subscription();
    private ground: Matter.Body | null = null;

    get isP1(): boolean {
        return this.player()?.role === 'player1';
    }

    get canPlace(): boolean {
        const p = this.player();
        if (!p || !this.turn()) return false;
        const turnPlayer = this.turn() === 'p1' ? 'player1' : 'player2';
        return p.role === turnPlayer;
    }

    get bothReady(): boolean {
        return this.p1Ready() && this.p2Ready();
    }

    constructor(
        private state: TestSlingWarStateService,
        private physics: PhysicsService,
        public windowSize: WindowSizeService,
    ) {
    }

    ngAfterViewInit() {
        this.initSubscriptions();
        this.initPhysics();

        this.windowSize.resize$.subscribe(dims => {
            this.setCanvasDimsFrom(dims.width, dims.height - 40);
            this.resizeCanvas(this.canvasWidth, this.canvasHeight);
        });
    }

    private setCanvasDimsFrom(width: number, height: number) {
        const gridLenX = width / this.GRID_X_NUM;
        const gridLenY = height / this.GRID_Y_NUM;
        this.GRID_PX = Math.min(gridLenX, gridLenY);
        this.canvasWidth = this.GRID_PX * this.GRID_X_NUM;
        this.canvasHeight = this.GRID_PX * this.GRID_Y_NUM;
    }

    private resizeCanvas(newWidth: number, newHeight: number): void {
        if (!this.physics.getRender() || !this.physics.getRender().canvas) return;

        // 1. Update the logical dimensions in the Render options object
        this.physics.getRender().options.width = newWidth;
        this.physics.getRender().options.height = newHeight;

        // 2. Update the actual HTML Canvas DOM attributes
        this.physics.getRender().canvas.width = newWidth;
        this.physics.getRender().canvas.height = newHeight;

        // 3. Force Matter.js to recalculate its internal camera bounds matching the new size
        Render.setPixelRatio(this.physics.getRender(), "auto" as unknown as any);
    }

    private initSubscriptions(): void {
        const roomSub = this.state.roomState$.subscribe((roomState) => {
            if (!roomState?.game) return;

            this.phase.set(roomState.game.phase);
            this.roomCode.set(roomState.code);
            this.player.set(this.state.player);

            this.p1Ready.set(!!roomState.players.find(p => p.role === 'player1')?.ready);
            this.p2Ready.set(!!roomState.players.find(p => p.role === 'player2')?.ready);
            this.p1Layout.set(roomState.players.find(p => p.role === 'player1')?.layout ?? []);
            this.p2Layout.set(roomState.players.find(p => p.role === 'player2')?.layout ?? []);

            if (roomState.game.phase === 'building') {
                const myP = this.state.player;
                const p1c = this.p1Layout().length;
                const p2c = this.p2Layout().length;

                if (myP?.role === 'player1') {
                    this.turn.set(p1c === p2c ? 'p1' : 'p2');
                } else {
                    this.turn.set(p2c === p1c ? 'p2' : 'p1');
                }
            } else {
                this.turn.set(null);
            }
        });
        this.subscription.add(roomSub);
    }

    private initPhysics(): void {
        const canvasEl = this.canvasRef?.nativeElement;
        if (!canvasEl) return;

        this.setCanvasDimsFrom(this.windowSize.width(), this.windowSize.height() - 40);
        this.physics.createEngine(canvasEl, this.canvasWidth, this.canvasHeight);
        this.ground = Matter.Bodies.rectangle(
            this.canvasWidth / 2,
            this.canvasHeight,
            this.canvasWidth,
            this.GRID_PX * 2,
            {isStatic: true, friction: 1, label: 'ground', render: {fillStyle: '#4a7c59'}},
        );
        Matter.World.add(this.physics.getEngine().world, this.ground);

        // Bind the render loop exactly ONCE, satisfying TypeScript
        Matter.Events.on(this.physics.getRender(), "afterRender", (event: Matter.IEvent<Matter.Render>) => {
            const ctx = this.physics.getRender()?.context;
            if (ctx) this.drawOverlay(ctx);
        });

        this.physics.createHeart(200, this.canvasHeight - 40);
        this.physics.createHeart(600, this.canvasHeight - 40);

        Matter.Render.run(this.physics.getRender());

        this.physics.startRunner();
    }

    private syncWorld(): void {
        if (!this.physics.getEngine()) return;

        const bodies = Matter.Composite.allBodies(this.physics.getEngine().world);
        const keep = bodies.filter(b => b.label === 'ground');

        Matter.World.clear(this.physics.getEngine().world, false);
        Matter.World.add(this.physics.getEngine().world, keep); // Re-adds our single existing ground

        const p1 = this.p1Layout();
        const p2 = this.p2Layout();

        if (p1.length > 0) this.physics.createBlocks(p1, this.GRID_PX);
        if (p2.length > 0) this.physics.createBlocks(p2, this.GRID_PX);

        this.physics.createHeart(this.canvasWidth / 2, this.canvasHeight - this.GRID_PX * 2);

        this.physics.startRunner();
    }

    // Extracted drawing logic to keep the file DRY
    private drawOverlay(ctx: CanvasRenderingContext2D): void {
        const zoneH = this.canvasHeight - this.GRID_PX;

        // P1 zone
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(0, 0, this.canvasWidth, zoneH);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.12)';
        ctx.fillRect(0, 0, this.canvasWidth, zoneH);

        // Grid lines
        const drawGrid = (ox: number) => {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            for (let gx = 0; gx <= ox + 220; gx += this.GRID_PX) {
                ctx.beginPath();
                ctx.moveTo(gx, 0);
                ctx.lineTo(gx, zoneH);
                ctx.stroke();
            }
            for (let gy = 0; gy <= zoneH; gy += this.GRID_PX) {
                ctx.beginPath();
                ctx.moveTo(0, gy);
                ctx.lineTo(ox, gy);
                ctx.stroke();
            }
        };
        drawGrid(260); // P1
        // drawGrid(this.canvasOffsetX + 700); // P2

        // Center divider
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(400, 0);
        ctx.lineTo(400, this.canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.fillText('YOUR FORTRESS', 80, this.canvasHeight - this.GRID_PX - 10);

        // Ground surface
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(0, this.canvasHeight - this.GRID_PX, this.canvasWidth, this.GRID_PX);
    }

    getBlockType(b: BlockKind) {
        return getBlockType(b);
    }

    onPaletteClick(kind: BlockKind): void {
        this.selectedKind.set(kind);
    }

    @HostListener("mousedown", ["$event"])
    onPointerDown(e: MouseEvent): void {
        if (!this.selectedKind() || !this.canPlace) {
            return;
        }

        this.dragging.set(true);
        this.updateDragPos(e);
        e.preventDefault();
    }

    @HostListener("mousemove", ["$event"])
    onPointerMove(e: MouseEvent): void {
        if (!this.dragging()) {
            return;
        }
        this.updateDragPos(e);
        e.preventDefault();
    }

    @HostListener("mouseup", ["$event"])
    onPointerUp(e: MouseEvent): void {
        const isInsideCanvas = this.canvasRef.nativeElement.contains(e.target as Node);

        if (!isInsideCanvas || !this.dragging() || !this.selectedKind()) {
            this.dragging.set(false);
            return;
        }

        this.placeBlock(e);
        this.dragging.set(false);
        this.selectedKind.set(null);
        e.preventDefault();
    }

    onPointerCancel(): void {
        this.dragging.set(false);
        this.selectedKind.set(null);
    }

    selectedBlockWidth = computed(() => this.selectedKind() ? getBlockType(this.selectedKind()).width * this.GRID_PX : 0);
    selectedBlockHeight = computed(() => this.selectedKind() ? getBlockType(this.selectedKind()).height * this.GRID_PX : 0);

    private updateDragPos(e: MouseEvent): void {
        const canvasEl = this.canvasRef?.nativeElement;
        if (!canvasEl) {
            return;
        }

        const rect = canvasEl.getBoundingClientRect();
        const rawCX = e.clientX - rect.left;
        const rawCY = e.clientY - rect.top;

        // 2. Figure out where the top-left corner WOULD be based on the block's size
        const targetLeft = rawCX - (this.selectedBlockWidth() / 2);
        const targetTop = rawCY - (this.selectedBlockHeight() / 2);

        // 3. Snap that imaginary top-left corner to the nearest grid intersection
        const snappedLeft = Math.round(targetLeft / this.GRID_PX) * this.GRID_PX;
        const snappedTop = Math.round(targetTop / this.GRID_PX) * this.GRID_PX;

        // 4. Calculate the final snapped center coordinates
        const gridCX = snappedLeft + (this.selectedBlockWidth() / 2);
        const gridCY = snappedTop + (this.selectedBlockHeight() / 2);

        this.dragWorldX.set(gridCX);
        this.dragWorldY.set(gridCY);
    }

    private placeBlock(e: MouseEvent): void {
        const kind = this.selectedKind();
        if (!kind) return;

        const bh = this.selectedBlockHeight() / 2;
        // const rect = this.canvasRef.nativeElement.getBoundingClientRect();

        const gridCX = this.dragWorldX();
        const gridCY = this.dragWorldY();
        // const rawCX = e.clientX - rect.left;
        // const rawCY = e.clientY - rect.top;

        // console.log("Raw", `(${rawCX}, ${rawCY})`);

        // 1. Math.floor(raw / this.GRID) finds the specific grid column/row (0, 1, 2...)
        // 2. Multiply by this.GRID to get the top-left X/Y of that specific cell
        // 3. Add (this.GRID / 2) to push the coordinate to the exact center of that cell
        // const gridCX = Math.floor(rawCX / this.GRID) * this.GRID + (this.GRID / 2);
        // const gridCY = Math.floor(rawCY / this.GRID) * this.GRID + (this.GRID / 2);

        console.log(`Canvas (${this.canvasWidth}, ${this.canvasHeight})`);
        console.log(`Grid size ${this.GRID_PX}`);

        console.log("Grid", `(${gridCX}, ${gridCY})`);

        // Apply strict zone clamping based on the player's role
        const minX = 0;
        const maxX = this.canvasWidth;
        const x = Math.max(minX, Math.min(maxX, gridCX));

        const groundY = this.canvasHeight - this.GRID_PX;
        const y = Math.max(this.GRID_PX, Math.min(groundY - bh, gridCY));

        console.log("Placement", `(${x}, ${y})`);

        const placement = {
            id: crypto.randomUUID(),
            type: kind,
            x, y,
            rotation: 0,
        };

        const currentLayout = this.isP1 ? [...this.p1Layout()] : [...this.p2Layout()];
        currentLayout.push(placement);

        const layout = this.isP1
            ? {p1: currentLayout, p2: this.p2Layout()}
            : {p1: this.p1Layout(), p2: currentLayout};

        this.state.sendLayout(layout);
        this.physics.createBlock(placement, this.GRID_PX);
        // this.syncWorld(); // Commenting for offline
    }

    readyUp(): void {
        this.state.readyUp();
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.physics.destroyWorld();

        if (this.physics.getRender()) {
            Matter.Render.stop(this.physics.getRender());
            this.physics.getRender().canvas.remove();
        }
    }
}