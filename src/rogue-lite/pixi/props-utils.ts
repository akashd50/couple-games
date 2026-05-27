import { IProps, PropsType } from "./constants";

export function all1sProps(): IProps {
    return {
        halfAngle: 1,
        range: 1,
        cooldown: 1,
        damage: 1,
        duration: 1,
        knockback: 1,
        everyN: 1,
        delay: 1,
        healPerTick: 1,
    } as IProps;
}

export function applyMultiplier(actual: IProps, m: IProps): IProps {
    return {
        ...actual,
        halfAngle: actual.halfAngle * m.halfAngle,
        range: actual.range * m.range,
        cooldown: actual.cooldown * m.cooldown,
        damage: actual.damage * m.damage,
        duration: actual.duration * m.duration,
        knockback: actual.knockback * m.knockback,
        everyN: actual.everyN * m.everyN,
        delay: actual.delay * m.delay,
        healPerTick: actual.healPerTick * m.healPerTick,
    } as IProps;
}

/*
export class Props implements IProps {
    type?: PropsType;
    range?: number;
    color: number;
    cooldown: number;
    damage: number;
    delay: number;
    duration: number;
    everyN: number;
    halfAngle: number;
    healPerTick: number;
    knockback: number;

    constructor() {
    }
}*/
