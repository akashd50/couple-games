import { Chaser } from "./chaser";
import { Player } from "./player";
import { Vec2 } from "../types";
import { Effect } from "../effects/effect";

export class HitInfo {
    damage: number;
    knockback: Vec2;
    success: boolean;

    constructor() {
        this.knockback = { x: 0, y: 0 };
        this.damage = 0;
        this.success = false;
    }

    add(h: HitInfo) {
        if (h === undefined) {
            return;
        }

        this.success = this.success || h.success;
        this.damage += h.damage ?? 0;
        this.knockback.x += h.knockback?.x ?? 0;
        this.knockback.y += h.knockback?.y ?? 0;
    }

    setDamage(d: number): HitInfo {
        this.damage += d;
        this.success = true;
        return this;
    }

    setKnockback(x: number, y: number): HitInfo {
        this.knockback.x = x;
        this.knockback.y = y;
        this.success = true;
        return this;
    }

    addDamage(d: number): HitInfo {
        this.damage += d;
        this.success = true;
        return this;
    }

    addKnockback(x: number, y: number): HitInfo {
        this.knockback.x += x;
        this.knockback.y += y;
        this.success = true;
        return this;
    }
}

export abstract class Resolver {
    protected hitSet = new Set<Chaser>();
    protected effects: Effect[] = [];

    abstract checkHit(player: Player, chaser: Chaser): HitInfo | undefined;

    abstract tryAttack(dt: number, aimAngle: number): number | undefined;

    abstract update(dt: number, move: Vec2, aimAngle: number): void;

    abstract draw(dt: number, move: Vec2, aimAngle: number): void;

    /** Mark `c` as struck so it is not hit again this cycle. */
    markHitEnemy(c: Chaser): void {
        this.hitSet.add(c);
    }

    /** Returns true if `c` was already struck during the current pulse cycle. */
    hasHitEnemy(c: Chaser): boolean {
        return this.hitSet.has(c);
    }

    protected clearHitSet() {
        this.hitSet.clear();
    }
}
