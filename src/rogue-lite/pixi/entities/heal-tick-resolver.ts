import { Resolver, HitInfo } from "./attacks";
import { Chaser } from "./chaser";
import { Vec2 } from "../types";
import { Player } from "./player";
import { IProps } from "../constants";
import { applyAM } from "../props-utils";

export class HealTickResolver extends Resolver {
    private healCooldown = 0;

    constructor(
        private readonly props: IProps,
        private readonly player: Player
    ) {
        super();
    }

    override checkHit(player: Player, chaser: Chaser): HitInfo | undefined {
        return undefined;
    }

    override tryAttack(dt: number, aimAngle: number): number | undefined {
        return undefined;
    }

    override update(dt: number, move: Vec2, aimAngle: number) {
        this.healCooldown -= dt;
        if (this.healCooldown <= 0) {
            const effective = applyAM(this.props, this.additive, this.multiplier);
            this.player.healBy(effective.healPerTick);
            this.healCooldown += this.props.cooldown * effective.cooldown;
        }
    }

    override draw(dt: number, move: Vec2, aimAngle: number) {
    }
}