import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from "../types";
import { wrapAngle } from "../common-utils";
import { Effect } from "./effect";
import { KnightConsts } from "../constants";
import { Chaser } from "../entities/chaser";

/**
 * Expanding cone-shaped shockwave visual.
 *
 * The cone's inner edge starts at `innerRadius` (matching the sword arc) and
 * its outer edge expands by `range` units over `duration` seconds.
 * The angular width is 2 × `halfAngle` and the whole cone faces `aimAngle`.
 *
 * This matches the design spec: "Shockwave starts past the sword range.
 * Cone-like shape — the smaller edge is the same arc as the sword swipe's."
 *
 * Usage:
 *   const fx = new ShockwaveEffect(
 *       fxLayer, px, py, aimAngle, halfAngle, swordRange, 220, 0x88aaff);
 *   // each fixed tick:
 *   fx.update(dt);
 *   if (fx.isDone) { fx.destroy(); remove from array; }
 *
 * Position is fixed at construction in world space — the cone stays at the
 * origin point even if the player moves.
 */
export class ShockwaveEffect extends Effect {
    private readonly gfx: Graphics;
    private elapsed = 0;
    private _done = false;

    /**
     * @param parent      Container in world space to attach to.
     * @param x           World X of the cone's apex (player position).
     * @param y           World Y of the cone's apex.
     * @param aimAngle    Direction the cone faces (radians).
     * @param halfAngle   Half angular width of the cone (matches sword cone).
     * @param innerRadius Distance from apex where the cone starts (sword range).
     * @param range   How far beyond `innerRadius` the outer edge expands.
     * @param color       Stroke / fill colour (0xRRGGBB).
     * @param duration    Total animation time in seconds (default 0.35).
     */
    constructor(
        parent: Container,
        public readonly x: number,
        public readonly y: number,
        public readonly aimAngle: number,
        public readonly halfAngle: number,
        private readonly innerRadius: number,
        private readonly range: number,
        private readonly color: number,
        private readonly duration = 0.35,
    ) {
        super();

        this.gfx = new Graphics();
        this.gfx.position.set(x, y);
        parent.addChild(this.gfx);
    }

    get isDone(): boolean {
        return this._done;
    }

    /**
     * Advance the animation by `dt` seconds.
     * Call once per fixed sim tick.
     */
    update(dt: number): void {
        this.elapsed += dt;
        const t = Math.min(1, this.elapsed / this.duration);

        if (t >= 1) {
            this._done = true;
            this.gfx.clear();
            return;
        }

        const innerR = this.innerRadius;
        const outerR = innerR + this.range * t;
        const alpha = (1 - t) * 0.85;
        const aStart = this.aimAngle - this.halfAngle;
        const aEnd = this.aimAngle + this.halfAngle;

        const cosStart = Math.cos(aStart);
        const sinStart = Math.sin(aStart);
        const cosEnd = Math.cos(aEnd);
        const sinEnd = Math.sin(aEnd);

        const g = this.gfx;
        g.clear();

        // ── Filled wedge (semi-transparent) ────────────────────────────────
        // Path: inner-edge start → outer arc (aStart→aEnd) → inner-edge end
        //       → inner arc back (aEnd→aStart, anticlockwise) → close
        g.moveTo(cosStart * innerR, sinStart * innerR);
        g.lineTo(cosStart * outerR, sinStart * outerR);
        g.arc(0, 0, outerR, aStart, aEnd);
        g.lineTo(cosEnd * innerR, sinEnd * innerR);
        g.arc(0, 0, innerR, aEnd, aStart, true);
        g.fill({ color: this.color, alpha: alpha * 0.28 });

        // ── Outer arc stroke (bright leading edge) ──────────────────────────
        g.arc(0, 0, outerR, aStart, aEnd);
        g.stroke({ color: this.color, width: 5, alpha });

        // ── Side edge lines (faint) ─────────────────────────────────────────
        g.moveTo(cosStart * innerR, sinStart * innerR);
        g.lineTo(cosStart * outerR, sinStart * outerR);
        g.moveTo(cosEnd * innerR, sinEnd * innerR);
        g.lineTo(cosEnd * outerR, sinEnd * outerR);
        g.stroke({ color: this.color, width: 2, alpha: alpha * 0.4 });
    }

    isInRange(chaser: Chaser): boolean {
        const outerRadius = this.innerRadius + this.range;
        const dx = chaser.posX - this.x;
        const dy = chaser.posY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > outerRadius + chaser.radius) {
            return false;
        }

        const enemyAngle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(wrapAngle(enemyAngle - this.aimAngle));
        return angleDiff <= this.halfAngle + 0.15;
    }

    destroy(): void {
        this.gfx.destroy();
    }
}
