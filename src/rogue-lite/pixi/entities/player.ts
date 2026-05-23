import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '../types';
import {
    ARENA_SIZE,
    PLAYER_COLOR,
    PLAYER_RADIUS,
    PLAYER_SPEED,
    SHIELD_ARC_HALF,
    SHIELD_COLOR,
} from '../constants';

/**
 * Knight player entity.
 * - Circle body (static Graphics, drawn once)
 * - Shield arc indicating facing direction (dynamic Graphics, redrawn each update)
 */
export class Player {
    private readonly container: Container;
    private readonly arcGfx: Graphics;
    private posX: number;
    private posY: number;

    constructor(parent: Container) {
        this.posX = ARENA_SIZE / 2;
        this.posY = ARENA_SIZE / 2;

        this.container = new Container();
        this.container.label = 'player';
        this.container.position.set(this.posX, this.posY);
        parent.addChild(this.container);

        // Body circle — drawn once, never changes
        const body = new Graphics();
        body.circle(0, 0, PLAYER_RADIUS).fill({ color: PLAYER_COLOR });
        this.container.addChild(body);

        // Shield arc — redrawn every sim tick to reflect current aim
        this.arcGfx = new Graphics();
        this.container.addChild(this.arcGfx);
        this.drawArc(0); // initial facing: right (0 radians)
    }

    get position(): Vec2 {
        return { x: this.posX, y: this.posY };
    }

    update(dt: number, move: Vec2, aimAngle: number): void {
        this.posX += move.x * PLAYER_SPEED * dt;
        this.posY += move.y * PLAYER_SPEED * dt;

        // Clamp to arena bounds
        const r = PLAYER_RADIUS;
        this.posX = Math.max(r, Math.min(ARENA_SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ARENA_SIZE - r, this.posY));

        this.container.position.set(this.posX, this.posY);
        this.drawArc(aimAngle);
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }

    private drawArc(aimAngle: number): void {
        const g = this.arcGfx;
        g.clear();
        const arcR = PLAYER_RADIUS + 6;
        const start = aimAngle - SHIELD_ARC_HALF;
        const end   = aimAngle + SHIELD_ARC_HALF;
        // arc() after clear() starts a fresh path at the arc's start point —
        // no stray line from origin.
        g.arc(0, 0, arcR, start, end);
        g.stroke({ color: SHIELD_COLOR, width: 3, alpha: 1 });
    }
}
