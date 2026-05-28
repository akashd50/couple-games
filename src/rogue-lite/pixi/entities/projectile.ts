import { Container, Graphics } from 'pixi.js';

/**
 * Specification for spawning a projectile.
 * Passed to ProjectileSystem.add() and stored on each Projectile instance.
 *
 * Designed to be reused for both enemy projectiles (Phase 5 boss bursts) and
 * player projectiles (Phase 6 Summoner attacks).
 */
export interface ProjectileSpec {
    /** World-space spawn position. */
    x: number;
    y: number;
    /** Normalised direction unit vector. */
    dx: number;
    dy: number;
    /** World units per second. */
    speed: number;
    /** HP damage on hit. */
    damage: number;
    /** Knockback impulse (world units/s) applied on hit. */
    knockback: number;
    /** Collision radius (world units). */
    radius: number;
    /** Fill colour (0xRRGGBB). */
    color: number;
    /** Seconds until the projectile expires. */
    lifetime: number;
}

/**
 * A single moving projectile.
 *
 * Owned and updated by ProjectileSystem.  Call destroy() only when removing
 * the instance from the ProjectileSystem pool.
 */
export class Projectile {
    posX: number;
    posY: number;

    private _lifetime: number;
    private readonly gfx: Graphics;
    private readonly spec: ProjectileSpec;

    constructor(parent: Container, spec: ProjectileSpec) {
        this.posX = spec.x;
        this.posY = spec.y;
        this._lifetime = spec.lifetime;
        this.spec = spec;

        // Small circle body + brighter inner dot for visual clarity
        this.gfx = new Graphics();
        this.gfx.circle(0, 0, spec.radius).fill({ color: spec.color, alpha: 0.9 });
        this.gfx.circle(0, 0, spec.radius * 0.45).fill({ color: 0xffffff, alpha: 0.7 });
        this.gfx.position.set(spec.x, spec.y);
        parent.addChild(this.gfx);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get isDead(): boolean { return this._lifetime <= 0; }
    get radius(): number  { return this.spec.radius; }
    get damage(): number  { return this.spec.damage; }
    get knockback(): number { return this.spec.knockback; }
    get dx(): number { return this.spec.dx; }
    get dy(): number { return this.spec.dy; }

    // ── Update / destroy ──────────────────────────────────────────────────────

    update(dt: number): void {
        this._lifetime -= dt;
        this.posX += this.spec.dx * this.spec.speed * dt;
        this.posY += this.spec.dy * this.spec.speed * dt;
        this.gfx.position.set(this.posX, this.posY);

        // Fade out over the last 30% of lifetime
        const fadeRatio = this.spec.lifetime * 0.3;
        this.gfx.alpha = fadeRatio > 0
            ? Math.min(1, this._lifetime / fadeRatio)
            : 1;
    }

    /** Mark as expired immediately (e.g. after hitting a target). */
    kill(): void {
        this._lifetime = 0;
    }

    destroy(): void {
        this.gfx.destroy();
    }
}
