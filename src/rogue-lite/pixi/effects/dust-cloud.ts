import { Container, Graphics } from 'pixi.js';
import { DustCloudConsts } from '../constants';

interface DustParticle {
    gfx: Graphics;
    lifetime: number;
    maxLifetime: number;
    baseRadius: number;
}

/**
 * Emits short-lived circular dust-cloud puffs at the player's feet as they move.
 *
 * Used by both KnightPlayer (soft lavender) and SummonerPlayer (vivid purple).
 * Parent container should be backgroundFxContainer so puffs render behind the body.
 *
 * Usage:
 *   const dust = new DustCloudSystem(player.backgroundFx, DustCloudConsts.KNIGHT_COLOR);
 *   // inside draw() each tick:
 *   dust.update(dt, player.posX, player.posY, effectiveSpeed);
 */
export class DustCloudSystem {
    private readonly particles: DustParticle[] = [];
    private emitTimer = 0;

    constructor(
        private readonly parent: Container,
        private readonly color: number,
    ) {}

    /**
     * Advance all particles and optionally emit a new puff.
     *
     * @param dt     Fixed sim delta (seconds).
     * @param x      Player world X — emission origin.
     * @param y      Player world Y.
     * @param speed  Player's effective movement speed (world units/s).
     *               Puffs are suppressed below DustCloudConsts.MIN_SPEED.
     */
    update(dt: number, x: number, y: number, speed: number): void {
        // Emission on interval while moving fast enough
        if (this.emitTimer > 0) this.emitTimer -= dt;
        if (speed >= DustCloudConsts.MIN_SPEED && this.emitTimer <= 0) {
            this.emit(
                x + (Math.random() - 0.5) * 10,
                y + (Math.random() - 0.5) * 10,
            );
            this.emitTimer = DustCloudConsts.EMIT_INTERVAL;
        }

        // Advance and redraw each particle
        for (const p of this.particles) {
            p.lifetime = Math.max(0, p.lifetime - dt);
            const frac   = p.lifetime / p.maxLifetime; // 1 → 0
            const alpha  = frac * DustCloudConsts.ALPHA_START;
            const radius = p.baseRadius * (0.55 + frac * 0.45); // gentle shrink
            p.gfx.clear();
            if (alpha > 0.004) {
                p.gfx.circle(0, 0, radius).fill({ color: this.color, alpha });
            }
        }

        // Retire spent particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (this.particles[i].lifetime <= 0) {
                this.particles[i].gfx.destroy();
                this.particles.splice(i, 1);
            }
        }
    }

    destroy(): void {
        for (const p of this.particles) p.gfx.destroy();
        this.particles.length = 0;
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private emit(x: number, y: number): void {
        const radius   = DustCloudConsts.RADIUS * (0.5 + Math.random() * 0.7);
        const lifetime = DustCloudConsts.LIFETIME * (0.65 + Math.random() * 0.5);

        const gfx = new Graphics();
        gfx.circle(0, 0, radius).fill({ color: this.color, alpha: DustCloudConsts.ALPHA_START });
        gfx.position.set(x, y);
        this.parent.addChild(gfx);

        this.particles.push({ gfx, lifetime, maxLifetime: lifetime, baseRadius: radius });
    }
}
