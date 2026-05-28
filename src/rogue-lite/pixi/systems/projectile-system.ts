import { Container } from 'pixi.js';
import { Projectile, ProjectileSpec } from '../entities/projectile';

/**
 * Called when a projectile collides with its target.
 * @param kbx     X knockback impulse to apply (world units/s).
 * @param kby     Y knockback impulse.
 * @param damage  HP damage to deal.
 * @returns       true if the hit landed (iframes active → return false to keep projectile alive).
 */
export type ProjectileHitHandler = (kbx: number, kby: number, damage: number) => boolean;

/**
 * Manages a pool of active projectiles that all target the same "team".
 *
 * Phase 5: one enemy-team instance (boss radial bursts → player).
 * Phase 6: a second player-team instance (Summoner attacks → enemies) can be
 *           created with a different hit-handler without touching this code.
 *
 * Projectile lifecycle:
 *   system.add(spec)         — create and track a new projectile
 *   system.update(...)       — advance physics, check collision, retire dead
 *   system.destroy()         — clean up all active projectiles
 */
export class ProjectileSystem {
    private readonly projectiles: Projectile[] = [];

    constructor(private readonly parent: Container) {}

    /** Spawn a new projectile from the given specification. */
    add(spec: ProjectileSpec): void {
        this.projectiles.push(new Projectile(this.parent, spec));
    }

    /**
     * Advance all projectiles and check for collision against a circular target.
     *
     * @param dt            Fixed sim delta (seconds).
     * @param targetX       World X of the collision target (e.g. player position).
     * @param targetY       World Y.
     * @param targetRadius  Collision radius of the target.
     * @param onHit         Called when overlap is detected; return true if hit landed.
     */
    update(
        dt: number,
        targetX: number,
        targetY: number,
        targetRadius: number,
        onHit: ProjectileHitHandler,
    ): void {
        for (const p of this.projectiles) {
            if (p.isDead) continue;

            p.update(dt);

            // Circle ↔ circle collision
            const dx = targetX - p.posX;
            const dy = targetY - p.posY;
            if (Math.hypot(dx, dy) < targetRadius + p.radius) {
                const dist = Math.hypot(dx, dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                const hit = onHit(nx * p.knockback, ny * p.knockback, p.damage);
                if (hit) {
                    p.kill();
                }
            }
        }

        // Retire dead projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].isDead) {
                this.projectiles[i].destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    /** Number of active (non-dead) projectiles. */
    get count(): number {
        return this.projectiles.filter(p => !p.isDead).length;
    }

    destroy(): void {
        for (const p of this.projectiles) p.destroy();
        this.projectiles.length = 0;
    }
}
