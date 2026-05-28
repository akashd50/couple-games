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

    // ── Optional cosmetics ────────────────────────────────────────────────────
    /**
     * When set, a fading trail is drawn behind the projectile using this colour.
     * Used by the Summoner's magic bullets.
     */
    trailColor?: number;
    /**
     * Visual shape of the bullet.
     *   'circle'   — default (two concentric circles, as in Phase 5)
     *   'triangle' — forwards-pointing triangle with a glow ring (Summoner)
     */
    shape?: 'circle' | 'triangle';
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
    private readonly trailGfx: Graphics | null = null;
    private readonly spec: ProjectileSpec;

    /** Ring buffer of recent world positions for trail rendering. */
    private readonly trailHistory: Array<{ x: number; y: number }> = [];
    private static readonly TRAIL_LENGTH = 10;

    constructor(parent: Container, spec: ProjectileSpec) {
        this.posX     = spec.x;
        this.posY     = spec.y;
        this._lifetime = spec.lifetime;
        this.spec     = spec;

        // Trail gfx added FIRST so it renders behind the bullet body
        if (spec.trailColor !== undefined) {
            this.trailGfx = new Graphics();
            parent.addChild(this.trailGfx);
        }

        this.gfx = new Graphics();

        if (spec.shape === 'triangle') {
            this.drawTriangle();
            // Rotate once to face the flight direction — stays fixed in flight
            this.gfx.rotation = Math.atan2(spec.dy, spec.dx);
        } else {
            // Default: two concentric circles
            this.gfx.circle(0, 0, spec.radius).fill({ color: spec.color, alpha: 0.9 });
            this.gfx.circle(0, 0, spec.radius * 0.45).fill({ color: 0xffffff, alpha: 0.7 });
        }

        this.gfx.position.set(spec.x, spec.y);
        parent.addChild(this.gfx);
    }

    // ── Getters ──────────────────────────────────────────────────────────────

    get isDead(): boolean  { return this._lifetime <= 0; }
    get radius(): number   { return this.spec.radius; }
    get damage(): number   { return this.spec.damage; }
    get knockback(): number { return this.spec.knockback; }
    get dx(): number       { return this.spec.dx; }
    get dy(): number       { return this.spec.dy; }

    // ── Update / destroy ──────────────────────────────────────────────────────

    update(dt: number): void {
        // Record position BEFORE moving (for the trail history)
        if (this.trailGfx) {
            this.trailHistory.unshift({ x: this.posX, y: this.posY });
            if (this.trailHistory.length > Projectile.TRAIL_LENGTH) {
                this.trailHistory.pop();
            }
        }

        this._lifetime -= dt;
        this.posX += this.spec.dx * this.spec.speed * dt;
        this.posY += this.spec.dy * this.spec.speed * dt;
        this.gfx.position.set(this.posX, this.posY);

        // Fade out over the last 30% of lifetime
        const fadeRatio = this.spec.lifetime * 0.3;
        this.gfx.alpha = fadeRatio > 0
            ? Math.min(1, this._lifetime / fadeRatio)
            : 1;

        // Render trail
        if (this.trailGfx && this.spec.trailColor !== undefined && this.trailHistory.length > 0) {
            const g = this.trailGfx;
            g.clear();
            const len = this.trailHistory.length;
            for (let i = 0; i < len; i++) {
                const { x, y } = this.trailHistory[i];
                const frac  = 1 - i / len;          // 1 at newest, 0 at oldest
                const alpha = frac * 0.55 * this.gfx.alpha;
                const r     = this.spec.radius * frac * 0.65;
                if (r > 0.5 && alpha > 0.008) {
                    g.circle(x, y, r).fill({ color: this.spec.trailColor, alpha });
                }
            }
        }
    }

    /** Mark as expired immediately (e.g. after hitting a target). */
    kill(): void {
        this._lifetime = 0;
        if (this.trailGfx) {
            this.trailGfx.clear();
            this.trailHistory.length = 0;
        }
    }

    destroy(): void {
        this.gfx.destroy();
        this.trailGfx?.destroy();
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /**
     * Draw a forward-pointing triangle with a soft glow ring.
     * Rotation to face the flight direction is applied by the caller.
     */
    private drawTriangle(): void {
        const r = this.spec.radius;
        const g = this.gfx;

        // Outer glow halo
        g.circle(0, 0, r * 2.2).fill({ color: this.spec.color, alpha: 0.10 });

        // Triangle pointing right (→) at rotation 0
        // Front tip at (+r*1.7, 0), two rear corners at (−r, ±r*0.85)
        g.moveTo( r * 1.7,  0)
         .lineTo(-r,        r * 0.85)
         .lineTo(-r * 0.35, 0)
         .lineTo(-r,       -r * 0.85)
         .lineTo( r * 1.7,  0)
         .fill({ color: this.spec.color, alpha: 0.95 });

        // Bright inner core
        g.circle(r * 0.25, 0, r * 0.45).fill({ color: 0xffffff, alpha: 0.85 });
    }
}
