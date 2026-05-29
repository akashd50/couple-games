import { Container } from "pixi.js";
import { Vec2 } from "../types";

export abstract class Entity {
    protected readonly _container: Container;
    protected readonly _bgContainer: Container;
    protected _position: Vec2 = new Vec2(0, 0);
    protected _velocity: Vec2 = new Vec2(0, 0);
    protected _hp: number;
    protected _maxHp: number;
    protected _iframes = 0;
    protected _radius = 0;

    constructor(parent?: Container) {
        if (parent) {
            this._container = new Container();
            this._bgContainer = new Container();
            this._bgContainer = new Container();
            this._bgContainer.label = "bg_fx";
            parent.addChild(this._bgContainer);
            parent.addChild(this._container);
        }
    }

    protected updateContainerPosition() {
        this._container.position.set(this._position.x, this._position.y);
    }

    get bgContainer() {
        return this._bgContainer;
    }

    getPosition(): Vec2 {
        return this._position;
    }

    getVelocity(): Vec2 {
        return this._velocity;
    }

    getRadius(): number {
        return this._radius;
    }

    get hp(): number {
        return this._hp;
    }

    get maxHp(): number {
        return this._maxHp;
    }
}