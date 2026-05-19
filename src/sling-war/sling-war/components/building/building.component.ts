import { Component, OnDestroy, AfterViewInit, ElementRef, ViewChild, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
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
    @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

    readonly BLOCK_TYPES = BLOCK_TYPES;
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

    // In building mode: who is currently placing (alternating turns)
    turn = signal<'p1' | 'p2' | null>(null);

    private subscription = new Subscription();
    private engine: Matter.Engine | null = null;
    private render: Matter.Render | null = null;

    get isP1(): boolean {
        const player = this.player();
        return player?.role === 'player1';
    }

    get canPlace(): boolean {
        const p = this.player();
        if (!p) return false;
        if (!this.turn()) return false;
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
        // Auto-destroy matter.js on cleanup
        effect(() => {
            const phase = this.phase();
            if (phase === null) return;
        });
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

            // Track building turn (alternating)
            if (roomState.game.phase === 'building') {
                const myP = this.state.player;
                if (myP?.role === 'player1') {
                    // P1 places first each round, reset turn when P1's block count > P2's
                    const p1c = this.p1Layout().length;
                    const p2c = this.p2Layout().length;
                    this.turn.set(p1c === p2c ? 'p1' : 'p2');
                } else {
                    const p1c = this.p1Layout().length;
                    const p2c = this.p2Layout().length;
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

        this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
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

        // Draw the build zone boundaries
        (this.render as any)?.on('afterRender', () => {
            const ctx = this.render?.context;
            if (!ctx || !this.engine) return;

            // Player 1 zone (left half)
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.strokeRect(this.canvasOffsetX + 20, 20, 360, this.canvasHeight - 40);
            ctx.fillStyle = '#4ade8044';
            ctx.fillRect(this.canvasOffsetX + 20, 20, 360, this.canvasHeight - 40);

            // Player 2 zone (right half)
            ctx.strokeStyle = '#f97316';
            ctx.strokeRect(this.canvasOffsetX + 420, 20, 360, this.canvasHeight - 40);
            ctx.fillStyle = '#f9731644';
            ctx.fillRect(this.canvasOffsetX + 420, 20, 360, this.canvasHeight - 40);

            ctx.setLineDash([]);

            // Center divider
            ctx.strokeStyle = '#ffffff44';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.canvasOffsetX + 400, 0);
            ctx.lineTo(this.canvasOffsetX + 400, this.canvasHeight);
            ctx.stroke();

            // Labels
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('YOUR FORTRESS', this.canvasOffsetX + 180, 510);
            ctx.fillStyle = '#f97316';
            ctx.fillText("OPPONENT'S FORTRESS", this.canvasOffsetX + 510, 510);

            // Ground
            ctx.fillStyle = '#333';
            ctx.fillRect(this.canvasOffsetX, this.canvasHeight - 10, this.canvasWidth, 10);
        });

        // Create hearts
        const bodies = this.physics.createHeart(this.canvasOffsetX + 200, this.canvasHeight - 40);
        this.physics.createHeart(this.canvasOffsetX + 600, this.canvasHeight - 40);

        this.physics.startRunner();
    }

    // Sync placed blocks to physics world
    private syncWorld(): void {
        if (!this.engine) return;
        Matter.World.clear(this.engine.world, false);
        Matter.Engine.clear(this.engine);

        // Clear render events
        (this.render as any)?.off('afterRender');

        const p1 = this.p1Layout();
        const p2 = this.p2Layout();

        if (p1.length > 0) this.physics.createBlocks(p1);
        if (p2.length > 0) this.physics.createBlocks(p2);

        this.physics.createHeart(this.canvasOffsetX + 200, this.canvasHeight - 40);
        this.physics.createHeart(this.canvasOffsetX + 600, this.canvasHeight - 40);

        // Redraw zone boundaries
        (this.render as any)?.on('afterRender', () => {
            const ctx = this.render?.context;
            if (!ctx || !this.engine) return;

            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 8]);
            ctx.strokeRect(this.canvasOffsetX + 20, 20, 360, this.canvasHeight - 40);
            ctx.fillStyle = '#4ade8044';
            ctx.fillRect(this.canvasOffsetX + 20, 20, 360, this.canvasHeight - 40);

            ctx.strokeStyle = '#f97316';
            ctx.strokeRect(this.canvasOffsetX + 420, 20, 360, this.canvasHeight - 40);
            ctx.fillStyle = '#f9731644';
            ctx.fillRect(this.canvasOffsetX + 420, 20, 360, this.canvasHeight - 40);

            ctx.setLineDash([]);

            ctx.strokeStyle = '#ffffff44';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.canvasOffsetX + 400, 0);
            ctx.lineTo(this.canvasOffsetX + 400, this.canvasHeight);
            ctx.stroke();

            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('YOUR FORTRESS', this.canvasOffsetX + 180, 510);
            ctx.fillStyle = '#f97316';
            ctx.fillText("OPPONENT'S FORTRESS", this.canvasOffsetX + 510, 510);

            ctx.fillStyle = '#333';
            ctx.fillRect(this.canvasOffsetX, this.canvasHeight - 10, this.canvasWidth, 10);
        });

        this.physics.startRunner();
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
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Canvas offset within the app = canvasOffsetX (120)
        const worldX = this.canvasOffsetX + x;
        const worldY = y;
        this.dragWorldX.set(worldX);
        this.dragWorldY.set(worldY);
    }

    private placeBlock(): void {
        const kind = this.selectedKind();
        if (!kind) return;

        const blockType = getBlockType(kind);
        const bw = blockType.width / 2;
        const bh = blockType.height / 2;

        // Clamp to player's build zone
        const x = Math.max(0, Math.min(this.canvasWidth - bw, this.dragWorldX() - bw));
        const y = Math.max(bh, Math.min(this.canvasHeight - bh, this.dragWorldY() - bh));

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
            ? { p1: currentLayout, p2: this.p2Layout() }
            : { p1: this.p1Layout(), p2: currentLayout };

        this.state.sendLayout(layout);
        this.syncWorld();
    }

    readyUp(): void {
        // If in building phase, readying up transitions to trivia
        // If in waiting phase, readying up starts building
        if (this.phase() === 'building') {
            this.state.readyUp();
        } else {
            this.state.readyUp();
        }
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.physics.destroyWorld();
        (this.render as any)?.stop();
        (this.render as any)?.destroy();
    }
}
