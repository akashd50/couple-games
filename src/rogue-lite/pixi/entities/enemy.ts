import { PhysicsConsts } from '../constants';

/**
 * Abstract base class for all enemy entities.
 *
 * Shared concrete behaviour lives here so subclasses never duplicate it:
 *   - World-space position (posX, posY)
 *   - Knockback velocity (vx, vy) with exponential friction
 *   - applyKnockback() implementation
 *   - flashTimer for white hit-flash VFX — subclasses read flashAlpha to tint
 *   - isBoss flag (false by default; HexBoss overrides to true)
 *
 * Each subclass owns:
 *   - Its Pixi Container / Graphics
 *   - AI state machine
 *   - HP tracking and HP-bar drawing
 *   - Concrete values for radius, contactDamage, contactKnockback, xpDropCount
 */
export abstract class Enemy {
    posX: number;
    posY: number;

    /** Knockback velocity — accumulated by applyKnockback(), decays via friction. */
    protected vx = 0;
    protected vy = 0;

    /** Seconds remaining for the white hit-flash.  0 = no flash. */
    protected flashTimer = 0;

    /**
     * Override to `true` in boss subclasses.
     * World uses this to trigger screenshake / XP-burst / heal-on-kill.
     */
    readonly isBoss: boolean = false;

    constructor(x: number, y: number) {
        this.posX = x;
        this.posY = y;
    }

    // ── Abstract contract ─────────────────────────────────────────────────────

    abstract readonly radius: number;
    abstract readonly hp: number;
    abstract readonly maxHp: number;
    abstract readonly isDead: boolean;

    /** Number of XP gems to drop on death. */
    abstract readonly xpDropCount: number;

    /**
     * XP value each dropped gem should carry.
     * Derived from the enemy's spawn level so higher-level enemies are worth more.
     */
    abstract readonly xpGemValue: number;

    /** Raw HP damage applied to the player on body contact. */
    abstract readonly contactDamage: number;

    /** Knockback impulse (world units/s) applied to the player on body contact. */
    abstract readonly contactKnockback: number;

    abstract update(dt: number, playerX: number, playerY: number): void;

    /**
     * Apply incoming damage and a knockback impulse.
     * Implementations should reduce HP, redraw the HP bar, and call startFlash().
     */
    abstract takeDamage(amount: number, kbx: number, kby: number): void;

    abstract destroy(): void;

    // ── Shared concrete behaviour ─────────────────────────────────────────────

    /** Add a knockback impulse to this enemy's velocity. */
    applyKnockback(kbx: number, kby: number): void {
        this.vx += kbx;
        this.vy += kby;
    }

    // ── Protected helpers (used by subclasses) ────────────────────────────────

    /**
     * Decay knockback velocity and advance the flash timer.
     * Call at the **top** of each subclass update() before any movement logic.
     */
    protected tickPhysics(dt: number): void {
        const friction = Math.exp(-PhysicsConsts.KNOCKBACK_FRICTION * dt);
        this.vx *= friction;
        this.vy *= friction;

        if (this.flashTimer > 0) {
            this.flashTimer = Math.max(0, this.flashTimer - dt);
        }
    }

    /**
     * Activate the white hit-flash for FLASH_DURATION seconds.
     * Call from takeDamage() in each subclass.
     */
    protected startFlash(): void {
        this.flashTimer = EnemyConsts.FLASH_DURATION;
    }

    /**
     * Alpha for the white flash overlay — 1 at peak, 0 when done.
     * Subclasses set their flashGfx.alpha to this value each tick.
     */
    protected get flashAlpha(): number {
        return this.flashTimer / EnemyConsts.FLASH_DURATION;
    }
}

// ── Shared VFX constants ──────────────────────────────────────────────────────

export class EnemyConsts {
    /** Duration of the white hit-flash in seconds. */
    static readonly FLASH_DURATION = 0.12;
}
