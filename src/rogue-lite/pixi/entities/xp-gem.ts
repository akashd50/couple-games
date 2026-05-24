import { Container, Graphics } from 'pixi.js';
import { XpGemConsts } from '../constants';

/**
 * XP gem dropped by an enemy on death.
 *
 * Behaviour:
 *  - Sits at its drop position until the player is within `magnetRadius`.
 *  - Inside magnet range (but outside pickup range) the gem drifts toward
 *    the player at {@link XpGemConsts.ATTRACTION_SPEED} world units/s.
 *  - When the player is within `pickupRadius` the gem is collected instantly:
 *    the container is destroyed and `update()` returns `true` that tick.
 *
 * Visual: a small teal diamond (rotated square) pointing upward.
 */
export class XpGem {
    posX: number;
    posY: number;

    private _collected = false;
    private readonly container: Container;

    constructor(parent: Container, x: number, y: number) {
        this.posX = x;
        this.posY = y;

        this.container = new Container();
        this.container.position.set(x, y);
        parent.addChild(this.container);

        const r = XpGemConsts.RADIUS;
        const g = new Graphics();
        // Diamond: top, right, bottom, left
        g.moveTo(0, -r)
         .lineTo(r * 0.55, 0)
         .lineTo(0, r)
         .lineTo(-r * 0.55, 0)
         .closePath()
         .fill({ color: XpGemConsts.COLOR });

        // Subtle inner highlight
        g.moveTo(0, -r * 0.5)
         .lineTo(r * 0.25, 0)
         .lineTo(0, r * 0.5)
         .lineTo(-r * 0.25, 0)
         .closePath()
         .fill({ color: 0xaaffdd, alpha: 0.35 });

        this.container.addChild(g);
    }

    get isCollected(): boolean { return this._collected; }
    /** XP value awarded when this gem is collected. */
    get value(): number { return XpGemConsts.XP_VALUE; }

    /**
     * Advance the gem's position/collection state.
     *
     * @param dt           Fixed sim delta (seconds).
     * @param playerX      Player world X.
     * @param playerY      Player world Y.
     * @param pickupRadius Player's current pickup radius.
     * @param magnetRadius Player's current magnet radius (0 = no attraction).
     * @returns `true` the single tick the gem is collected.
     */
    update(
        dt: number,
        playerX: number,
        playerY: number,
        pickupRadius: number,
        magnetRadius: number,
    ): boolean {
        if (this._collected) return false;

        const dx = playerX - this.posX;
        const dy = playerY - this.posY;
        const dist = Math.hypot(dx, dy);

        // Attract when within magnet radius but not yet in pickup range
        if (magnetRadius > 0 && dist < magnetRadius && dist > 0.5) {
            const nx = dx / dist;
            const ny = dy / dist;
            const step = XpGemConsts.ATTRACTION_SPEED * dt;
            this.posX += nx * step;
            this.posY += ny * step;
            this.container.position.set(this.posX, this.posY);
        }

        // Collect when within pickup radius
        if (dist <= pickupRadius) {
            this._collected = true;
            this.container.destroy({ children: true });
            return true;
        }

        return false;
    }

    /** Called during World.destroy() to clean up any un-collected gems. */
    destroy(): void {
        if (!this._collected) {
            this._collected = true;
            this.container.destroy({ children: true });
        }
    }
}
