import { Component, OnDestroy, AfterViewInit, ElementRef, ViewChild, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlingWarStateService } from '../../services/sling-war-state.service';
import { PhysicsService } from '../../services/physics.service';
import { BLOCK_TYPES, getBlockType } from '../../data/block-types';
import type { BlockKind, BlockPlacement, SlingWarGamePlayer } from '../../../game.types';
import { Subscription } from 'rxjs';
import Matter from 'matter-js';

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
    readonly GRID = 30;
    readonly canvasOffsetX = 120;
    readonly canvasWidth = 800;
    readonly canvasHeight = 600;

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
    private engine: Matter.Engine | null = null;
    private render: Matter.Render | null = null;
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
        private state: SlingWarStateService,
        private physics: PhysicsService,
    ) {
    }

    ngAfterViewInit() {
        this.initSubscriptions();
        this.initPhysics();
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

        this.engine = Matter.Engine.create({gravity: {x: 0, y: 1}});
        this.render = Matter.Render.create({
            canvas: canvasEl,
            engine: this.engine,
            options: {
                width: this.canvasWidth,
                height: this.canvasHeight,
                wireframes: false,
                hasBounds: true,
            },
        });

        this.ground = Matter.Bodies.rectangle(
            this.canvasOffsetX + this.canvasWidth / 2,
            this.canvasHeight + this.GRID / 2,
            this.canvasWidth + this.GRID,
            this.GRID,
            {isStatic: true, friction: 1, label: 'ground', render: {fillStyle: '#4a7c59'}},
        );
        Matter.World.add(this.engine.world, this.ground);

        // Bind the render loop exactly ONCE, satisfying TypeScript
        Matter.Events.on(this.render, "afterRender", (event: Matter.IEvent<Matter.Render>) => {
            const ctx = this.render?.context;
            if (ctx) this.drawOverlay(ctx);
        });

        this.physics.createHeart(this.canvasOffsetX + 200, this.canvasHeight - 40);
        this.physics.createHeart(this.canvasOffsetX + 600, this.canvasHeight - 40);

        Matter.Render.run(this.render);

        this.physics.startRunner();
    }

    private syncWorld(): void {
        if (!this.engine) return;

        const bodies = Matter.Composite.allBodies(this.engine.world);
        const keep = bodies.filter(b => b.label === 'ground');

        Matter.World.clear(this.engine.world, false);
        Matter.World.add(this.engine.world, keep); // Re-adds our single existing ground

        const p1 = this.p1Layout();
        const p2 = this.p2Layout();

        if (p1.length > 0) this.physics.createBlocks(p1);
        if (p2.length > 0) this.physics.createBlocks(p2);

        this.physics.createHeart(this.canvasOffsetX + 200, this.canvasHeight - 40);
        this.physics.createHeart(this.canvasOffsetX + 600, this.canvasHeight - 40);

        this.physics.startRunner();
    }

    // Extracted drawing logic to keep the file DRY
    private drawOverlay(ctx: CanvasRenderingContext2D): void {
        const zoneH = this.canvasHeight - this.GRID - 40;

        // P1 zone
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(this.canvasOffsetX + 20, 20, 240, zoneH);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.12)';
        ctx.fillRect(this.canvasOffsetX + 20, 20, 240, zoneH);

        // P2 zone
        ctx.strokeStyle = '#f97316';
        ctx.strokeRect(this.canvasOffsetX + 460, 20, 240, zoneH);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
        ctx.fillRect(this.canvasOffsetX + 460, 20, 240, zoneH);
        ctx.setLineDash([]);

        // Grid lines
        const drawGrid = (ox: number) => {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            for (let gx = this.canvasOffsetX + 20; gx <= ox + 220; gx += this.GRID) {
                ctx.beginPath();
                ctx.moveTo(gx, 20);
                ctx.lineTo(gx, 20 + zoneH);
                ctx.stroke();
            }
            for (let gy = 20; gy <= 20 + zoneH; gy += this.GRID) {
                ctx.beginPath();
                ctx.moveTo(this.canvasOffsetX + 20, gy);
                ctx.lineTo(ox + 20, gy);
                ctx.stroke();
            }
        };
        drawGrid(this.canvasOffsetX + 260); // P1
        drawGrid(this.canvasOffsetX + 700); // P2

        // Center divider
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(this.canvasOffsetX + 400, 0);
        ctx.lineTo(this.canvasOffsetX + 400, this.canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = '#4ade80';
        ctx.fillText('YOUR FORTRESS', this.canvasOffsetX + 80, this.canvasHeight - this.GRID - 10);
        ctx.fillStyle = '#f97316';
        ctx.fillText("OPPONENT'S FORTRESS", this.canvasOffsetX + 490, this.canvasHeight - this.GRID - 10);

        // Ground surface
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(this.canvasOffsetX, this.canvasHeight - this.GRID, this.canvasWidth, this.GRID);
        ctx.fillStyle = '#3d6b4e';
        ctx.fillRect(this.canvasOffsetX, this.canvasHeight - 3, this.canvasWidth, 3);
    }

    getBlockType(b: BlockKind) {
        return getBlockType(b);
    }

    onPaletteClick(kind: BlockKind): void {
        this.selectedKind.set(kind);
    }

    onPointerDown(e: MouseEvent): void {
        if (!this.selectedKind() || !this.canPlace) return;
        this.dragging.set(true);
        this.updateDragPos(e);
        e.preventDefault();
    }

    onPointerMove(e: MouseEvent): void {
        if (!this.dragging()) return;
        this.updateDragPos(e);
        e.preventDefault();
    }

    onPointerUp(e: MouseEvent): void {
        if (!this.dragging() || !this.selectedKind()) {
            this.dragging.set(false);
            return;
        }
        this.placeBlock();
        this.dragging.set(false);
        this.selectedKind.set(null);
        e.preventDefault();
    }

    onPointerCancel(): void {
        this.dragging.set(false);
        this.selectedKind.set(null);
    }

    private updateDragPos(e: MouseEvent): void {
        const canvasEl = this.canvasRef?.nativeElement;
        if (!canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();

        this.dragWorldX.set(this.canvasOffsetX + (e.clientX - rect.left));
        this.dragWorldY.set(e.clientY - rect.top);
    }

    private placeBlock(): void {
        const kind = this.selectedKind();
        if (!kind) return;

        const blockType = getBlockType(kind);
        const bh = blockType.height / 2;

        const rawCX = this.dragWorldX();
        const rawCY = this.dragWorldY();
        const gridCX = Math.round((rawCX - this.canvasOffsetX) / this.GRID) * this.GRID;
        const gridCY = Math.round(rawCY / this.GRID) * this.GRID;

        // Apply strict zone clamping based on the player's role
        const minX = this.isP1 ? 20 : 460;
        const maxX = this.isP1 ? 260 : 700;
        const x = Math.max(minX, Math.min(maxX, gridCX));

        const groundY = this.canvasHeight - this.GRID / 2;
        const y = Math.max(this.GRID, Math.min(groundY - bh, gridCY));

        const placement = {
            id: crypto.randomUUID(),
            type: kind,
            x: this.canvasOffsetX + x,
            y,
            rotation: 0,
        };

        const currentLayout = this.isP1 ? [...this.p1Layout()] : [...this.p2Layout()];
        currentLayout.push(placement);

        const layout = this.isP1
            ? {p1: currentLayout, p2: this.p2Layout()}
            : {p1: this.p1Layout(), p2: currentLayout};

        this.state.sendLayout(layout);
        this.syncWorld();
    }

    readyUp(): void {
        this.state.readyUp();
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.physics.destroyWorld();

        if (this.render) {
            Matter.Render.stop(this.render);
            this.render.canvas.remove();
        }
    }
}