import { Container, Graphics } from 'pixi.js';
import { Effect } from "./effect";
import { Chaser } from "../entities/chaser";
import { Vec2 } from "../types";
import { IProps } from "../constants";

interface AuraPulse {
    phase: number;
    currentRadius: number;
    prevRadius: number;
}

export class AuraEffect extends Effect {
    private readonly gfx: Graphics;
    private elapsed = 0;
    /** 0 → 1 cycling phase within the current pulse. */
    private _phase = 0;
    /** Ring radius at the start of the last sim tick (world units). */
    private _prevRadius = 0;
    /** Ring radius at the end of the last sim tick. */
    private _currentRadius = 0;
    private lastPos: Vec2;
    private pulses: AuraPulse[] = [];

    constructor(
        parent: Container,
        public readonly origin: Vec2,
        private props: IProps,
        private readonly loop = false,
        private readonly track = false,
    ) {
        super();
        this.gfx = new Graphics();
        this.gfx.position.set(origin.x, origin.y);
        parent.addChild(this.gfx);
    }

    /**
     * Advance the animation by `dt` seconds.
     * Call once per fixed sim tick.
     */
    update(dt: number, pos?: Vec2, props?: IProps): void {
        if (this.onDoneSubject.value) {
            return;
        }

        if (props != null) {
            this.props = props;
        }

        this.lastPos = pos;
        if (this.track) {
            this.gfx.position.set(pos.x, pos.y);
        }

        this._prevRadius = this._phase * this.props.range;
        this._phase += dt / this.props.duration;
        if (this._phase >= 1) {
            if (this.loop) {
                this._phase -= 1;
                this.onLoopSubject.next(true);
            } else {
                this.onDoneSubject.next(true);
                this.gfx.clear();
                return;
            }
        }

        this._currentRadius = this._phase * this.props.range;

        const g = this.gfx;
        g.clear();

        // Static outer boundary circle (always visible while aura is active)
        g.circle(0, 0, this.props.range);
        g.stroke({ color: this.props.color, width: 1, alpha: 0.12 });

        // Expanding pulse ring — fades as it reaches the boundary
        const pulseRadius = this._phase * this.props.range;
        if (pulseRadius > 1) {
            g.circle(0, 0, pulseRadius);
            g.stroke({ color: this.props.color, width: 4, alpha: (1 - this._phase) * 0.55 });
        }
    }

    isInRange(chaser: Chaser): boolean {
        const dx = chaser.posX - this.lastPos.x;
        const dy = chaser.posY - this.lastPos.y;
        const dist = Math.hypot(dx, dy);
        return dist < this._currentRadius + chaser.radius && dist >= Math.max(0, this._prevRadius - chaser.radius);
    }

    destroy(): void {
        this.gfx.destroy();
    }
}
