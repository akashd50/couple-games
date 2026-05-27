import { Resolver, HitInfo } from "./attacks";
import { Chaser } from "./chaser";
import { Vec2 } from "../types";
import { Player } from "./player";
import { Props } from "../constants";

export class HealTickResolver extends Resolver {
    private healBonus = 0;
    private healCooldown = 0;
    private cooldownMult = 1;

    constructor(
        private readonly props: Props,
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

    addHealBonus(healBonus: number): void {
        this.healBonus += healBonus;
    }

    override update(dt: number, move: Vec2, aimAngle: number) {
        this.healCooldown -= dt;
        if (this.healCooldown <= 0) {
            this.player.healBy(this.props.healPerTick + this.healBonus);
            this.healCooldown += this.props.cooldown * this.cooldownMult;
        }
    }

    override draw(dt: number, move: Vec2, aimAngle: number) {
    }
}