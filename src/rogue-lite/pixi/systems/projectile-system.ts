import { Container } from 'pixi.js';
import { Projectile, ProjectileSpec } from '../entities/projectile';
import type { Enemy } from '../entities/enemy';
import { HitInfo } from "../entities/attacks";
import { getDirectionTo } from "../common-utils";

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

    constructor(private readonly parent: Container) {
    }

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

    tUpdate(dt: number) {
        for (const p of this.projectiles) {
            if (p.isDead) {
                continue;
            }

            p.update(dt);
        }

        // Retire dead projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i].isDead) {
                this.projectiles[i].destroy();
                this.projectiles.splice(i, 1);
            }
        }
    }

    /**
     * Advance all projectiles and check for collision against multiple enemies.
     *
     * Used by the Summoner's player-projectile system (one system, many targets),
     * as opposed to the boss projectile system which targets only the player.
     *
     * @param dt       Fixed sim delta (seconds).
     * @param enemies  All active enemy instances to test against.
     * @param onHit    Called when a projectile overlaps an enemy.
     *                 Receives the enemy + knockback direction + damage.
     *                 Return true if the hit landed (kills the projectile); false to pass through.
     */
    updateAgainstEnemies(
        dt: number,
        enemies: Enemy[],
        onHit: (enemy: Enemy, kbx: number, kby: number, damage: number) => boolean,
    ): void {
        for (const p of this.projectiles) {
            if (p.isDead) continue;

            p.update(dt);

            for (const enemy of enemies) {
                if (enemy.isDead) continue;
                const dx = enemy.posX - p.posX;
                const dy = enemy.posY - p.posY;
                if (Math.hypot(dx, dy) < enemy.radius + p.radius) {
                    const dist = Math.hypot(dx, dy) || 1;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const hit = onHit(enemy, nx * p.knockback, ny * p.knockback, p.damage);
                    if (hit) {
                        p.kill();
                        break; // one hit per projectile
                    }
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

    checkHit(enemy: Enemy): HitInfo {
        const hitInfo = new HitInfo();

        if (enemy.isDead) {
            return hitInfo;
        }

        for (const p of this.projectiles) {
            if (p.isDead) {
                continue;
            }

            const dx = enemy.posX - p.posX;
            const dy = enemy.posY - p.posY;
            if (Math.hypot(dx, dy) < enemy.radius + p.radius) {
                p.kill();
                const dist = Math.hypot(dx, dy) || 1;
                const nx = dx / dist;
                const ny = dy / dist;
                return hitInfo
                    .addDamage(p.damage)
                    .addKnockback(nx * p.knockback, ny * p.knockback);
            }
        }

        return hitInfo;
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
