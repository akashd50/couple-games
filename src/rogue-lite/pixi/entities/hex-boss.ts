import { Container, Graphics } from 'pixi.js';
import { ArenaConsts, HexBossConsts } from '../constants';
import { Enemy } from './enemy';

/** Callback signature for firing a single projectile from the boss. */
export type BossFireCallback = (x: number, y: number, dx: number, dy: number) => void;

const enum BossState {
    CHARGE,
    TELEGRAPH,
    BURST,
    RECOVER,
}

/**
 * Hexagon mini-boss.
 *
 * Finite-state machine:
 *   CHARGE (3.0s)      → moves toward the player at SPEED_CHARGE
 *   TELEGRAPH (0.55s)  → stops, pulses visually to warn of incoming burst
 *   BURST (instant)    → fires BURST_COUNT evenly-spaced radial projectiles
 *   RECOVER (1.1s)     → stationary before the next charge
 *   → loop
 *
 * Bosses are heavier than regular enemies: incoming knockback is scaled by
 * HexBossConsts.KNOCKBACK_RECEIVED_MULT so they are not easily juggled.
 *
 * Spawned via BossSpawnerSystem; destroyed and replaced at the next interval.
 */
export class HexBoss extends Enemy {
    override readonly isBoss = true;
    readonly xpDropCount = HexBossConsts.XP_DROP_COUNT;
    readonly contactDamage = HexBossConsts.HIT_DAMAGE;
    readonly contactKnockback = HexBossConsts.KNOCKBACK;

    private _hp: number;
    private readonly _maxHp: number;
    private readonly _level: number;

    // ── Pixi containers ───────────────────────────────────────────────────────
    private readonly container: Container;
    private readonly bodyGfx: Graphics;
    private readonly flashGfx: Graphics;
    private readonly hpBarGfx: Graphics;

    // ── State machine ─────────────────────────────────────────────────────────
    private state: BossState = BossState.CHARGE;
    private stateTimer: number;
    /** Slow rotation angle (radians), updated each tick. */
    private rotation = 0;

    /**
     * @param parent             Pixi container to attach graphics to.
     * @param x                  World-space spawn X.
     * @param y                  World-space spawn Y.
     * @param level              Enemy level derived from run time (≥ 1).
     *                           Higher levels yield proportionally more HP and XP.
     * @param onFireProjectile   Called once per projectile during the burst phase.
     */
    constructor(
        parent: Container,
        x: number,
        y: number,
        level = 1,
        private readonly onFireProjectile: BossFireCallback,
    ) {
        super(x, y);

        this._level = level;

        const hpMult = 1 + (level - 1) * HexBossConsts.HP_SCALE_PER_LEVEL;
        const scaledHp = Math.round(HexBossConsts.HP * hpMult);
        this._hp = scaledHp;
        this._maxHp = scaledHp;
        this.stateTimer = HexBossConsts.CHARGE_DURATION;

        // Outer container — holds world position + HP bar
        this.container = new Container();
        this.container.label = 'hex-boss';
        this.container.position.set(x, y);
        parent.addChild(this.container);

        // Hexagon body
        this.bodyGfx = new Graphics();
        this.container.addChild(this.bodyGfx);
        this.drawHex(HexBossConsts.COLOR, HexBossConsts.OUTLINE_COLOR);

        // White flash overlay (same hex shape, rendered on top)
        this.flashGfx = new Graphics();
        this.container.addChild(this.flashGfx);
        this.drawFlashHex();
        this.flashGfx.alpha = 0;

        // HP bar
        this.hpBarGfx = new Graphics();
        this.container.addChild(this.hpBarGfx);
        this.drawHpBar();
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    get radius(): number  { return HexBossConsts.RADIUS; }
    get hp(): number      { return this._hp; }
    get maxHp(): number   { return this._maxHp; }
    get isDead(): boolean { return this._hp <= 0; }

    /** XP awarded per gem dropped; scales with spawn level. */
    get xpGemValue(): number {
        return HexBossConsts.XP_VALUE_BASE + (this._level - 1) * HexBossConsts.XP_VALUE_PER_LEVEL;
    }

    // ── Core loop ─────────────────────────────────────────────────────────────

    update(dt: number, playerX: number, playerY: number): void {
        this.tickPhysics(dt);

        // Slow menacing rotation
        this.rotation += dt * 0.6;
        this.bodyGfx.rotation = this.rotation;
        this.flashGfx.rotation = this.rotation;

        // Flash overlay
        this.flashGfx.alpha = this.flashAlpha;

        // State machine
        this.stateTimer -= dt;

        switch (this.state) {
            case BossState.CHARGE:
                this.doCharge(dt, playerX, playerY);
                if (this.stateTimer <= 0) this.enterState(BossState.TELEGRAPH, HexBossConsts.TELEGRAPH_DURATION);
                break;

            case BossState.TELEGRAPH:
                // Visual pulsing handled by draw (bodyGfx outline color cycles)
                this.doTelegraphDraw();
                if (this.stateTimer <= 0) this.doBurst(playerX, playerY);
                break;

            case BossState.BURST:
                // Transition happens immediately inside doBurst(); nothing to tick.
                break;

            case BossState.RECOVER:
                // Stationary — apply friction only (done in tickPhysics)
                if (this.stateTimer <= 0) this.enterState(BossState.CHARGE, HexBossConsts.CHARGE_DURATION);
                break;
        }

        this.container.position.set(this.posX, this.posY);
    }

    takeDamage(amount: number, kbx: number, kby: number): void {
        if (this._hp <= 0) return;
        this._hp = Math.max(0, this._hp - amount);
        // Boss is heavy — greatly reduce incoming knockback
        this.vx += kbx * HexBossConsts.KNOCKBACK_RECEIVED_MULT;
        this.vy += kby * HexBossConsts.KNOCKBACK_RECEIVED_MULT;
        this.startFlash();
        this.drawHpBar();
    }

    destroy(): void {
        this.container.destroy({ children: true });
    }

    // ── Private: state transitions ────────────────────────────────────────────

    private enterState(next: BossState, duration: number): void {
        this.state = next;
        this.stateTimer = duration;
        // Restore normal appearance on leaving TELEGRAPH
        if (next !== BossState.TELEGRAPH) {
            this.drawHex(HexBossConsts.COLOR, HexBossConsts.OUTLINE_COLOR);
        }
    }

    private doCharge(dt: number, playerX: number, playerY: number): void {
        const dx = playerX - this.posX;
        const dy = playerY - this.posY;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
            const nx = dx / dist;
            const ny = dy / dist;
            this.posX += (nx * HexBossConsts.SPEED_CHARGE + this.vx) * dt;
            this.posY += (ny * HexBossConsts.SPEED_CHARGE + this.vy) * dt;
        }
        // Clamp to arena
        const r = HexBossConsts.RADIUS;
        this.posX = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posX));
        this.posY = Math.max(r, Math.min(ArenaConsts.SIZE - r, this.posY));
    }

    private doTelegraphDraw(): void {
        // Pulse the outline between normal and bright-yellow as a warning
        const t = this.stateTimer / HexBossConsts.TELEGRAPH_DURATION;
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 8);
        // Blend outline from normal to bright yellow
        const outlineColor = pulse > 0.5 ? 0xffff00 : HexBossConsts.OUTLINE_COLOR;
        this.drawHex(HexBossConsts.COLOR, outlineColor);
    }

    private doBurst(playerX: number, playerY: number): void {
        const count = HexBossConsts.BURST_COUNT;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            this.onFireProjectile(
                this.posX,
                this.posY,
                Math.cos(angle),
                Math.sin(angle),
            );
        }
        this.enterState(BossState.RECOVER, HexBossConsts.RECOVER_DURATION);
    }

    // ── Private: draw helpers ─────────────────────────────────────────────────

    /** Build a regular hexagon path with the given fill/outline. */
    private drawHex(fillColor: number, outlineColor: number): void {
        const g = this.bodyGfx;
        g.clear();
        const r = HexBossConsts.RADIUS;
        const sides = 6;
        const startAngle = Math.PI / 6; // flat-top orientation

        g.moveTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r);
        for (let i = 1; i <= sides; i++) {
            const a = startAngle + (Math.PI * 2 * i) / sides;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.fill({ color: fillColor });
        g.moveTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r);
        for (let i = 1; i <= sides; i++) {
            const a = startAngle + (Math.PI * 2 * i) / sides;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.stroke({ color: outlineColor, width: 3 });
    }

    /** Build the white flash hexagon overlay (drawn once, alpha driven at runtime). */
    private drawFlashHex(): void {
        const g = this.flashGfx;
        g.clear();
        const r = HexBossConsts.RADIUS;
        const sides = 6;
        const startAngle = Math.PI / 6;

        g.moveTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r);
        for (let i = 1; i <= sides; i++) {
            const a = startAngle + (Math.PI * 2 * i) / sides;
            g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.fill({ color: 0xffffff });
    }

    private drawHpBar(): void {
        const g = this.hpBarGfx;
        g.clear();

        const barW = 90;
        const barH = 7;
        const barX = -barW / 2;
        const barY = -HexBossConsts.RADIUS - 18;

        // Background
        g.rect(barX - 1, barY - 1, barW + 2, barH + 2).fill({ color: 0x000000 });
        // Track
        g.rect(barX, barY, barW, barH).fill({ color: 0x440000 });
        // Fill
        const fillW = Math.max(0, (this._hp / this._maxHp) * barW);
        if (fillW > 0) {
            g.rect(barX, barY, fillW, barH).fill({ color: HexBossConsts.OUTLINE_COLOR });
        }

        // "BOSS" text drawn as a thick small indicator bar outline label
        // (actual text rendering avoided to stay Angular/DOM free; relies on visual clarity)
    }
}
