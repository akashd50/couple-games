import { Container } from "pixi.js";
import { Vec2 } from "../types";

export abstract class Entity {
    protected readonly container: Container;
    protected position: Vec2 = { x: 0, y: 0 };
    protected velocity: Vec2 = { x: 0, y: 0 };
    protected _hp: number;
    protected _maxHp: number;
    protected iframes = 0;

    constructor(parent: Container) {
        this.container = new Container();
        parent.addChild(this.container);
    }
}