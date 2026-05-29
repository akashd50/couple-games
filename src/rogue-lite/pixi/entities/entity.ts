import { Container } from "pixi.js";
import { Vec2 } from "../types";

export abstract class Entity {
    protected readonly container: Container;
    protected position: Vec2 = new Vec2(0, 0);
    protected velocity: Vec2 = new Vec2(0, 0);
    protected _hp: number;
    protected _maxHp: number;
    protected iframes = 0;
    protected radius = 0;

    constructor(parent?: Container) {
        if (parent) {
            this.container = new Container();
            parent.addChild(this.container);
        }
    }

    protected updateContainerPosition() {
        this.container.position.set(this.position.x, this.position.y);
    }

    getPosition(): Vec2 {
        return this.position;
    }

    getVelocity(): Vec2 {
        return this.velocity;
    }

    getRadius(): number {
        return this.radius;
    }

    get hp(): number {
        return this._hp;
    }

    get maxHp(): number {
        return this._maxHp;
    }
}