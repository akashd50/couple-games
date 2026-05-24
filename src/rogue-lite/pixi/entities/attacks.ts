import { Chaser } from "./chaser";
import { AttackProps, KnightConsts, KnightProps } from "../constants";
import { Player } from "./player";
import { isInAttackCone } from "../systems/attack-system";
import { Vec2 } from "../types";
import { lerp } from "../common-utils";
import { Graphics } from "pixi.js";

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
}

export abstract class AttackResolver {
    protected hitSet = new Set<Chaser>();

    abstract checkHit(player: Player, chaser: Chaser);

    abstract tryAttack(dt: number, aimAngle: number): number;

    abstract update(dt: number, move: Vec2, aimAngle: number): void;

    abstract draw(dt: number, move: Vec2, aimAngle: number);

    getGfx(): Graphics[] {
        return [];
    }

    clearHitSet() {
        this.hitSet.clear();
    }
}

export class SwingAttackResolver extends AttackResolver {
    /** Counts down to 0; attack fires when it crosses 0. */
    private attackCooldown: number;
    /** Counts down from ATTACK_ARC_DURATION to 0 while the swing arc is visible. */
    private swingTimer = 0;
    /** Aim angle captured when the attack fired (used for the visual). */
    private swingAngle = 0;
    private props: AttackProps;
    private arcStart: number;
    private arcEnd: number;
    private readonly swingGfx: Graphics;

    constructor(props: AttackProps) {
        super();
        this.props = props;
        this.attackCooldown = props.cooldown * 0.5;
        this.swingGfx = new Graphics();
    }

    get progress(): number {
        if (this.swingTimer <= 0) {
            return undefined;
        }
        return (this.props.duration - this.swingTimer) / this.props.duration;
    }

    override getGfx(): Graphics[] {
        return [this.swingGfx];
    }

    override update(dt: number, move: Vec2, aimAngle: number) {
        if (this.swingTimer > 0) {
            this.swingTimer = Math.max(0, this.swingTimer - dt);
        }

        const halfAngle = this.props.halfAngle;
        this.arcStart = this.swingAngle - halfAngle;
        this.arcEnd = this.arcStart + 2 * halfAngle * this.progress;
    }

    override tryAttack(dt: number, aimAngle: number): number {
        this.attackCooldown -= dt;
        if (this.attackCooldown <= 0) {
            // += COOLDOWN to preserve any overshoot (keeps timing precise)
            this.attackCooldown += this.props.cooldown;
            this.swingTimer = this.props.duration;
            this.swingAngle = aimAngle;
            this.clearHitSet();
            return aimAngle;
        }
        return undefined;
    }

    override checkHit(player: Player, chaser: Chaser): HitInfo {
        if (this.swingTimer <= 0 || this.hitSet.has(chaser)) {
            return undefined;
        }

        if (isInAttackCone(player.position.x, player.position.y, this.arcStart, this.arcEnd, chaser.posX, chaser.posY, chaser.radius)) {
            const dx2 = chaser.posX - player.position.x;
            const dy2 = chaser.posY - player.position.y;
            const d2 = Math.hypot(dx2, dy2);
            const kbx = d2 > 0.001 ? (dx2 / d2) * this.props.knockback : this.props.knockback;
            const kby = d2 > 0.001 ? (dy2 / d2) * this.props.knockback : 0;
            this.hitSet.add(chaser);

            return {
                damage: this.props.damage,
                knockback: { x: kbx, y: kby },
                success: true,
            } as HitInfo;
        }

        return undefined;
    }

    override draw(dt: number, move: Vec2, aimAngle: number): void {
        const g = this.swingGfx;
        g.clear();
        if (this.swingTimer <= 0) {
            return;
        }

        const { duration, range, color } = KnightConsts.autoAttack;
        const alpha = this.swingTimer / duration;
        const start = this.swingAngle - (Math.PI / 6); // 30° half-angle
        const end = this.swingAngle + (Math.PI / 6);
        const normalizedSwingTimer = (duration - this.swingTimer) / duration;
        const currEnd = lerp(start, end, normalizedSwingTimer);

        // Swing arc trail
        g.arc(0, 0, range, start, currEnd);
        g.stroke({ color: color, width: 4, alpha });

        // Sword at the leading edge of the swing
        const cos = Math.cos(currEnd);
        const sin = Math.sin(currEnd);
        const perpCos = -Math.sin(currEnd);
        const perpSin = Math.cos(currEnd);

        const hiltDist = KnightConsts.radius + 2;
        const guardDist = KnightConsts.radius + 10;
        const guardWidth = 8;

        // Blade
        g.moveTo(cos * hiltDist, sin * hiltDist);
        g.lineTo(cos * range, sin * range);
        g.stroke({ color: color, width: 3, alpha });

        // Crossguard
        g.moveTo(cos * guardDist + perpCos * guardWidth, sin * guardDist + perpSin * guardWidth);
        g.lineTo(cos * guardDist - perpCos * guardWidth, sin * guardDist - perpSin * guardWidth);
        g.stroke({ color: color, width: 3, alpha });
    }
}

export function getAttackResolver(attack: AttackProps): AttackResolver {
    switch (attack.type) {
        case "swing":
            return new SwingAttackResolver(attack);
    }
}