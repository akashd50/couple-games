import { Container, Graphics } from 'pixi.js';

interface Particle {
    gfx: Graphics;
    vx: number;
    vy: number;
    lifetime: number;
    maxLifetime: number;
}

/**
 * Manages a pool of short-lived radial particles for enemy-death VFX.
 *
 * Usage:
 *   const system = new DeathParticleSystem(worldLayer);
 *   // on enemy death:
 *   system.emitBurst(enemy.posX, enemy.posY, 0xcc3333, 8);
 *   // each tick:
 *   system.update(dt);
 *   // cleanup:
 *   system.destroy();
 */
export class DeathParticleSystem {
    private readonly particles: Particle[] = [];

    constructor(private readonly parent: Container) {}

    /**
     * Spawn `count` particles in a random radial pattern at world position (x, y).
     *
     * @param x       World X of the burst origin.
     * @param y       World Y.
     * @param color   Fill colour (0xRRGGBB).
     * @param count   Number of particles (default 8).
     * @param radius  Particle dot radius (default 4).
     * @param speed   Initial outward speed (default 220 world units/s).
     */
    emitBurst(
        x: number,
        y: number,
        color: number,
        count = 8,
        radius = 4,
        speed = 220,
    ): void {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const mag   = speed * (0.6 + Math.random() * 0.8);

            const gfx = new Graphics();
            gfx.circle(0, 0, radius).fill({ color });
            gfx.position.set(x, y);
            this.parent.addChild(gfx);

            const lifetime = 0.30 + Math.random() * 0.20;
            this.particles.push({
                gfx,
                vx: Math.cos(angle) * mag,
                vy: Math.sin(angle) * mag,
                lifetime,
                maxLifetime: lifetime,
            });
        }
    }

    /**
     * Advance all particles.  Call once per fixed sim tick.
     */
    update(dt: number): void {
        const friction = 0.88; // simple per-frame drag (not exp, intentionally simpler)

        for (const p of this.particles) {
            if (p.lifetime <= 0) continue;

            p.lifetime -= dt;
            p.vx *= friction;
            p.vy *= friction;
            p.gfx.x += p.vx * dt;
            p.gfx.y += p.vy * dt;
            p.gfx.alpha = Math.max(0, p.lifetime / p.maxLifetime);
        }

        // Retire spent particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (this.particles[i].lifetime <= 0) {
                this.particles[i].gfx.destroy();
                this.particles.splice(i, 1);
            }
        }
    }

    /** Destroy all active particles and free Pixi resources. */
    destroy(): void {
        for (const p of this.particles) p.gfx.destroy();
        this.particles.length = 0;
    }
}
