import { Chaser } from "../entities/chaser";
import { Vec2 } from "../types";
import { BehaviorSubject } from "rxjs";

export abstract class Effect {
    protected onDoneSubject = new BehaviorSubject<boolean>(false);
    protected onLoopSubject = new BehaviorSubject<boolean>(false);
    public onDone$ = this.onDoneSubject.asObservable();
    public onLoop$ = this.onLoopSubject.asObservable();

    public get isDone(): boolean {
        return this.onDoneSubject.value;
    }

    abstract update(_dt: number, pos?: Vec2): void;

    abstract destroy(): void;

    abstract isInRange(chaser: Chaser): boolean;
}