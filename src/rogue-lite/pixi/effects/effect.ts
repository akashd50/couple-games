import { Enemy } from "../entities/enemy";
import { Vec2 } from "../types";
import { BehaviorSubject } from "rxjs";
import { IProps } from "../constants";

export abstract class Effect {
    protected onDoneSubject = new BehaviorSubject<boolean>(false);
    protected onLoopSubject = new BehaviorSubject<boolean>(false);
    public onDone$ = this.onDoneSubject.asObservable();
    public onLoop$ = this.onLoopSubject.asObservable();

    public get isDone(): boolean {
        return this.onDoneSubject.value;
    }

    abstract update(_dt: number, pos?: Vec2, props?: IProps): void;

    abstract destroy(): void;

    abstract isInRange(enemy: Enemy): boolean;
}
