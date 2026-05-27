import { Chaser } from "../entities/chaser";

export abstract class Effect {
    abstract update(_dt: number): void;

    abstract destroy(): void;

    abstract isDone: boolean;

    abstract isInRange(chaser: Chaser): boolean;
}