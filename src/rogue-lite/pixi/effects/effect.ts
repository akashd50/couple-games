import { Chaser } from "../entities/chaser";
import { Vec2 } from "../types";
import { BehaviorSubject } from "rxjs";

export abstract class Effect {
    protected onDoneSubject = new BehaviorSubject<boolean>(false);
    protected onLoopSubject = new BehaviorSubject<boolean>(false);
    public onDone$ = this.onDoneSubject.asObservable();
    public onLoop$ = this.onLoopSubject.asObservable();

    abstract update(_dt: number, pos: Vec2): void;

    abstract destroy(): void;

    abstract isDone: boolean;

    abstract isInRange(chaser: Chaser): boolean;
}