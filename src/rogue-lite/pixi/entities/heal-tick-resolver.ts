import { Resolver, HitInfo } from "./attacks";
import { Enemy } from "./enemy";
import { Vec2 } from "../types";
import { Player } from "./player";
import { IProps } from "../constants";
import { applyAM } from "../props-utils";
import { Entity } from "./entity";

export class HealTickResolver extends Resolver {
    private healCooldown = 0;

    constructor(
        private readonly props: IProps,
        private readonly player: Player
    ) {
        super();
    }

    override checkHit(enemy: Entity): HitInfo | undefined {
        return undefined;
    }

    override tryAttack(_dt: number, _aimAngle: number): number | undefined {
        return undefined;
    }

    override update(dt: number, _move: Vec2, _aimAngle: number) {
        this.healCooldown -= dt;
        if (this.healCooldown <= 0) {
            const effective = applyAM(this.props, this.additive, this.multiplier);
            this.player.healBy(effective.healPerTick);
            this.healCooldown += this.props.cooldown * effective.cooldown;
        }
    }

    override draw(_dt: number, _move: Vec2, _aimAngle: number) {
    }
}
