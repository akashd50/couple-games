import { Container, Graphics } from 'pixi.js';
import { Effect } from "./effect";
import { Chaser } from "../entities/chaser";
import { Vec2 } from "../types";
import { IProps } from "../constants";

interface AuraPulse {
    /** 0 → 1 progress through the pulse duration. */
    phase: number;
    /** Ring radius at the end of the last sim tick (world units). */
    currentRadius: number;
    /** Ring radius at the start of the last sim tick (world units). */
    prevRadius: number;
    /**
     * Per-pulse hit set. Enemies are added here when the ring sweeps through
     * them so they cannot be struck twice by the same pass.
     * Discarded automatically when the pulse is removed.
     */
    hitSet: Set<Chaser>;
}

export class AuraEffect extends Effect {
    private readonly gfx: Graphics;
    private lastPos: Vec2;
    private pulses: AuraPulse[] = [];
    /** Seconds elapsed since the last pulse was spawned (used for cooldown-driven multi-pulse). */
    private cooldownAccum = 0;

    constructor(
        parent: Container,
        public readonly origin: Vec2,
        private props: IProps,
        private readonly loop = false,
        private readonly track = false,
    ) {
        super();
        this.lastPos = origin;
        this.gfx = new Graphics();
        this.gfx.position.set(origin.x, origin.y);
        parent.addChild(this.gfx);
        // Always kick off the first pulse immediately.
        this.spawnPulse();
    }

    private spawnPulse(): void {
        this.pulses.push({ phase: 0, currentRadius: 0, prevRadius: 0, hitSet: new Set() });
    }

    /**
     * Advance the animation by `dt` seconds.
     * Call once per fixed sim tick.
     *
     * Multi-pulse behaviour:
     *   - cooldown = 0  → a single pulse runs; on completion it restarts immediately
     *                     (same visual as before, one ring at a time).
     *   - cooldown > 0  → a new pulse is spawned every `cooldown` seconds while the
     *                     effect is looping, so multiple rings can overlap.
     */
    update(dt: number, pos?: Vec2, props?: IProps): void {
        if (this.onDoneSubject.value) return;

        if (props != null) this.props = props;
        if (pos != null) this.lastPos = pos;
        if (this.track && pos != null) this.gfx.position.set(pos.x, pos.y);

        const { range, duration, cooldown } = this.props;

        // ── Cooldown-driven pulse spawning ────────────────────────────────────
        // Only active when looping with a positive cooldown; the first pulse was
        // already spawned in the constructor so the gap before pulse 2 is exactly
        // one cooldown period.
        if (this.loop && cooldown > 0) {
            this.cooldownAccum += dt;
            if (this.cooldownAccum >= cooldown) {
                this.cooldownAccum -= cooldown;
                this.spawnPulse();
            }
        }

        // ── Advance & retire each pulse ───────────────────────────────────────
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const p = this.pulses[i];

            p.prevRadius = p.phase * range;
            p.phase += dt / duration;
            p.currentRadius = Math.min(p.phase, 1) * range;

            if (p.phase >= 1) {
                if (this.loop && cooldown <= 0) {
                    // Zero-cooldown loop: restart this pulse in-place rather than
                    // removing it, so there is never a gap between passes.
                    p.phase -= 1;
                    p.prevRadius = 0;
                    p.currentRadius = p.phase * range;
                    p.hitSet.clear();
                } else {
                    // Positive-cooldown loop OR non-looping: the cooldown timer
                    // above handles spawning the replacement, so just retire this one.
                    this.pulses.splice(i, 1);
                }
                this.onLoopSubject.next(true);
            }
        }

        // ── Non-loop: signal done when the single pulse finishes ──────────────
        if (!this.loop && this.pulses.length === 0) {
            this.onDoneSubject.next(true);
            this.gfx.clear();
            return;
        }

        // ── Draw ──────────────────────────────────────────────────────────────
        const g = this.gfx;
        g.clear();

        // Static outer boundary circle (always visible while the aura is active).
        g.circle(0, 0, range);
        g.stroke({ color: this.props.color, width: 1, alpha: 0.12 });

        // Each expanding pulse ring — fades to transparent as it reaches the edge.
        for (const p of this.pulses) {
            if (p.currentRadius > 1) {
                g.circle(0, 0, p.currentRadius);
                g.stroke({ color: this.props.color, width: 4, alpha: (1 - p.phase) * 0.55 });
            }
        }
    }

    /**
     * Returns `true` if `chaser` falls within the swept band of **any** active
     * pulse that has not already hit it this pass.  The chaser is immediately
     * recorded in that pulse's hit set so subsequent calls this pass return
     * `false` — no double-damage from a single ring.
     *
     * Because hit dedup is tracked per-pulse, overlapping pulses can each
     * independently strike the same enemy.
     */
    isInRange(chaser: Chaser): boolean {
        const dx = chaser.posX - this.lastPos.x;
        const dy = chaser.posY - this.lastPos.y;
        const dist = Math.hypot(dx, dy);

        for (const p of this.pulses) {
            if (p.hitSet.has(chaser)) continue;
            if (dist <  p.currentRadius + chaser.radius &&
                dist >= Math.max(0, p.prevRadius - chaser.radius)) {
                p.hitSet.add(chaser);
                return true;
            }
        }
        return false;
    }

    destroy(): void {
        // Clear pulses so Chaser refs inside hitSets can be GC'd.
        this.pulses = [];
        this.gfx.destroy();
    }
}
