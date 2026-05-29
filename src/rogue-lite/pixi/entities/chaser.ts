import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, ChaserConsts } from '../constants';
import { Enemy } from './enemy';

const enum ChaserState {
    WANDER,
    CHASE,
}

/**
 * Red triangle enemy.
 * - Wanders randomly until the player enters CHASER_AGGRO_RANGE
 * - Then chases in a straight line
 * - Falls back to wander if the player escapes CHASER_DEAGGRO_RANGE
 *
 * Accepts a `level` (derived from run time) and scales HP, speed, and XP gem
 * value internally — the caller never needs to compute raw multipliers.
 *
 * Outer container holds position + HP bar (never rotated).
 * Inner bodyContainer holds the triangle graphic and rotates to face movement.
 */
export class Chaser extends Enemy {
    readonly xpDropCount = 1;
    readonly contactDamage = ChaserConsts.HIT_DAMAGE;
    readonly contactKnockback = ChaserConsts.KNOCKBACK;

    private readonly bodyContainer: Container;
    private readonly hpBarGfx: Graphics;
    private readonly flashGfx: Graphics;

    private state: ChaserState = ChaserState.WANDER;
    private wanderAngle: number;
    private wanderTimer = 0;

    private readonly speedWander: number;
    private readonly speedChase: number;
    private readonly _level: number;

    /**
     * @param parent  Pixi container to attach graphics to.
     * @param x       World-space spawn X.
     * @param y       World-space spawn Y.
     * @param level   Enemy level derived from run time (≥ 1).
     *                Level 1 = base stats; each additional level scales HP, speed, and XP drop.
     */
    constructor(parent: Container, x: number, y: number, level = 1) {
        super(x, y, parent);

        this._level = level;

        // Derive multipliers from level — all scaling knowledge lives here
        const hpMult = 1 + (level - 1) * ChaserConsts.HP_SCALE_PER_LEVEL;
        const speedMult = 1 + (level - 1) * ChaserConsts.SPEED_SCALE_PER_LEVEL;
        const scaledHp = Math.round(ChaserConsts.HP * hpMult);

        this._hp = scaledHp;
        this._maxHp = scaledHp;
        this.speedWander = ChaserConsts.SPEED_WANDER * speedMult;
        this.speedChase = ChaserConsts.SPEED_CHASE * speedMult;
        this._radius = ChaserConsts.RADIUS;

        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = Math.random() * 1.5; // stagger initial direction change

        // Outer container — moves with position, never rotates
        this._container.label = 'chaser';
        this._container.position.set(x, y);
        parent.addChild(this._container);

        // Inner body container — rotates to face movement direction
        this.bodyContainer = new Container();
        this._container.addChild(this.bodyContainer);

        // Triangle (equilateral-ish, pointing right at rotation=0)
        const body = new Graphics();
        body.moveTo(this._radius, 0)
            .lineTo(-this._radius * 0.75, -this._radius * 0.65)
            .lineTo(-this._radius * 0.75, this._radius * 0.65)
            .lineTo(this._radius, 0)
            .fill({ color: ChaserConsts.COLOR });
        this.bodyContainer.addChild(body);

        // White flash overlay — same triangle shape, alpha driven by flashTimer
        this.flashGfx = new Graphics();
        this.flashGfx.moveTo(this._radius, 0)
            .lineTo(-this._radius * 0.75, -this._radius * 0.65)
            .lineTo(-this._radius * 0.75, this._radius * 0.65)
            .lineTo(this._radius, 0)
            .fill({ color: 0xffffff });
        this.flashGfx.alpha = 0;
        this.bodyContainer.addChild(this.flashGfx);

        // HP bar — child of outer container so it stays horizontal
        this.hpBarGfx = new Graphics();
        this._container.addChild(this.hpBarGfx);
    }

    get isDead(): boolean {
        return this._hp <= 0;
    }

    get level(): number {
        return this._level;
    }

    /** XP awarded per gem dropped; scales with spawn level. */
    get xpGemValue(): number {
        return ChaserConsts.XP_VALUE_BASE + (this._level - 1) * ChaserConsts.XP_VALUE_PER_LEVEL;
    }

    /**
     * Advance the Chaser's AI and physics by one sim step.
     * @param dt        Fixed sim delta in seconds.
     * @param playerX   Player world X (for AI targeting).
     * @param playerY   Player world Y.
     */
    update(dt: number, playerX: number, playerY: number): void {
        // Decay knockback velocity and advance flash timer (base class)
        this.tickPhysics(dt);

        // Update flash overlay
        this.flashGfx.alpha = this.flashAlpha;

        const dx = playerX - this._position.x;
        const dy = playerY - this._position.y;
        const dist = Math.hypot(dx, dy);

        // ── State machine ──────────────────────────────────────────────────────
        if (this.state === ChaserState.WANDER && dist < ChaserConsts.AGGRO_RANGE) {
            this.state = ChaserState.CHASE;
        } else if (this.state === ChaserState.CHASE && dist > ChaserConsts.DEAGGRO_RANGE) {
            this.state = ChaserState.WANDER;
            this.wanderAngle = Math.random() * Math.PI * 2;
            this.wanderTimer = 1.0 + Math.random();
        }

        // ── Movement direction ─────────────────────────────────────────────────
        let moveX = 0;
        let moveY = 0;

        if (this.state === ChaserState.CHASE) {
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

        const speed = this.state === ChaserState.CHASE
            ? this.speedChase
            : this.speedWander;

        // ── Physics ────────────────────────────────────────────────────────────
        this._position.add((moveX * speed + this._velocity.x) * dt, (moveY * speed + this._velocity.y) * dt);

        // Clamp to arena
        const r = ChaserConsts.RADIUS;
        this._position.set(Math.max(r, Math.min(ArenaConsts.SIZE - r, this._position.x)), Math.max(r, Math.min(ArenaConsts.SIZE - r, this._position.y)));
        this.updateContainerPosition();

        // Rotate body to face movement direction
        if (Math.abs(moveX) + Math.abs(moveY) > 0.01) {
            this.bodyContainer.rotation = Math.atan2(moveY, moveX);
        }
    }

    /**
     * Apply damage and knockback impulse (direction = away from attacker).
     * @param amount  HP to remove.
     * @param kbx     X component of knockback impulse (world units/s).
     * @param kby     Y component of knockback impulse.
     */
    takeDamage(amount: number, kbx: number, kby: number): void {
        if (this._hp <= 0) return;
        this._hp = Math.max(0, this._hp - amount);
        this._velocity.add(kbx, kby);
        this.startFlash();
        this.drawHpBar();
    }

    destroy(): void {
        this._container.destroy({ children: true });
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private drawHpBar(): void {
        const g = this.hpBarGfx;
        g.clear();
        // Don't show bar at full HP
        if (this._hp >= this._maxHp) return;

        const barW = 28;
        const barH = 3;
        const barX = -barW / 2;
        const barY = -ChaserConsts.RADIUS - 9;

        // Background track
        g.rect(barX, barY, barW, barH).fill({ color: 0x330000 });
        // Filled portion
        const fillW = Math.max(0, (this._hp / this._maxHp) * barW);
        if (fillW > 0) {
            g.rect(barX, barY, fillW, barH).fill({ color: 0xff4444 });
        }
    }
}
