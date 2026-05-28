import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, TankConsts } from '../constants';
import { Enemy } from './enemy';

const enum TankState {
    WANDER,
    CHASE,
}

/** Optional per-tank stat overrides applied at spawn time (difficulty ramp). */
export interface TankStats {
    hpMult?: number;
    speedMult?: number;
}

/**
 * Blue-purple square enemy.
 *
 * - Wanders randomly until the player enters AGGRO_RANGE.
 * - Chases in a straight line; de-aggros when far enough away.
 * - Slower and tankier than the Chaser; hits harder and knocks back more.
 *
 * Outer container holds position + HP bar (never rotated).
 * Inner bodyContainer holds the square graphic and rotates to face movement.
 */
export class Tank extends Enemy {
    readonly xpDropCount = TankConsts.XP_DROP_COUNT;
    readonly contactDamage = TankConsts.HIT_DAMAGE;
    readonly contactKnockback = TankConsts.KNOCKBACK;

    private readonly container: Container;
    private readonly bodyContainer: Container;
    private readonly hpBarGfx: Graphics;
    private readonly flashGfx: Graphics;

    private _hp: number;
    private readonly _maxHp: number;
    private state: TankState = TankState.WANDER;
    private wanderAngle: number;
    private wanderTimer = 0;

    private readonly speedWander: number;
    private readonly speedChase: number;

    constructor(parent: Container, x: number, y: number, stats: TankStats = {}) {
        super(x, y);

        const hpMult    = stats.hpMult    ?? 1;
        const speedMult = stats.speedMult ?? 1;
        const scaledHp  = Math.round(TankConsts.HP * hpMult);

        this._hp    = scaledHp;
        this._maxHp = scaledHp;
        this.speedWander = TankConsts.SPEED_WANDER * speedMult;
        this.speedChase  = TankConsts.SPEED_CHASE  * speedMult;

        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = Math.random() * 1.5;

        // Outer container — moves with position, never rotates
        this.container = new Container();
        this.container.label = 'tank';
        this.container.position.set(x, y);
        parent.addChild(this.container);

        // Inner body — rotates to face movement
        this.bodyContainer = new Container();
        this.container.addChild(this.bodyContainer);

        // Square body (pointing right at rotation=0)
        const r = TankConsts.RADIUS;
        const body = new Graphics();
        body.rect(-r, -r, r * 2, r * 2)
            .fill({ color: TankConsts.COLOR })
            .rect(-r, -r, r * 2, r * 2)
            .stroke({ color: TankConsts.OUTLINE_COLOR, width: 2.5 });
        this.bodyContainer.addChild(body);

        // White flash overlay — same square shape, alpha driven by flashTimer
        this.flashGfx = new Graphics();
        this.flashGfx.rect(-r, -r, r * 2, r * 2).fill({ color: 0xffffff });
        this.flashGfx.alpha = 0;
        this.bodyContainer.addChild(this.flashGfx);

        // HP bar (child of outer container — stays horizontal)
        this.hpBarGfx = new Graphics();
        this.container.addChild(this.hpBarGfx);
    }

    get radius(): number { return TankConsts.RADIUS; }
    get hp(): number     { return this._hp; }
    get maxHp(): number  { return this._maxHp; }
    get isDead(): boolean { return this._hp <= 0; }
    get position() { return { x: this.posX, y: this.posY }; }

    update(dt: number, playerX: number, playerY: number): void {
        this.tickPhysics(dt);

        // Update flash overlay alpha
        this.flashGfx.alpha = this.flashAlpha;

        const dx = playerX - this.posX;
        const dy = playerY - this.posY;
        const dist = Math.hypot(dx, dy);

        // ── State machine ──────────────────────────────────────────────────
        if (this.state === TankState.WANDER && dist < TankConsts.AGGRO_RANGE) {
            this.state = TankState.CHASE;
        } else if (this.state === TankState.CHASE && dist > TankConsts.DEAGGRO_RANGE) {
            this.state = TankState.WANDER;
            this.wanderAngle = Math.random() * Math.PI * 2;
            this.wanderTimer = 1.0 + Math.random();
        }

        // ── Movement direction ─────────────────────────────────────────────
        let moveX = 0;
        let moveY = 0;

        if (this.state === TankState.CHASE) {
            if (dist > 0.1) {
                moveX = dx / dist;
                moveY = dy / dist;
            }
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderAngle = Math.random() * Math.PI * 2;
                this.wanderTimer = 1.5 + Math.random();
            }
            moveX = Math.cos(this.wanderAngle);
            moveY = Math.sin(this.wanderAngle);
        }

        const speed = this.state === TankState.CHASE ? this.speedChase : this.speedWander;

        // ── Physics ────────────────────────────────────────────────────────
        this.posX += (moveX * speed + this.vx) * dt;
        this.posY += (moveY * speed + this.vy) * dt;

        // Clamp to arena
        const r = TankConsts.RADIUS;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY));

        this.container.position.set(this.posX, this.posY);

        // Rotate body to face movement direction
        if (Math.abs(moveX) + Math.abs(moveY) > 0.01) {
            this.bodyContainer.rotation = Math.atan2(moveY, moveX);
        }
    }

    takeDamage(amount: number, kbx: number, kby: number): void {
        if (this._hp <= 0) return;
        this._hp = Math.max(0, this._hp - amount);
        this.vx += kbx;
        this.vy += kby;
        this.startFlash();
        this.drawHpBar();
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private drawHpBar(): void {
        const g = this.hpBarGfx;
        g.clear();
        if (this._hp >= this._maxHp) return;

        const barW = 36;
        const barH = 4;
        const barX = -barW / 2;
        const barY = -TankConsts.RADIUS - 11;

        g.rect(barX, barY, barW, barH).fill({ color: 0x001a66 });
        const fillW = Math.max(0, (this._hp / this._maxHp) * barW);
        if (fillW > 0) {
            g.rect(barX, barY, fillW, barH).fill({ color: TankConsts.COLOR });
        }
    }
}
