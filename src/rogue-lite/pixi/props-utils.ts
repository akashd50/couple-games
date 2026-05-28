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

export function all0sProps(): IProps {
    return {
        halfAngle: 0,
        range: 0,
        cooldown: 0,
        damage: 0,
        duration: 0,
        knockback: 0,
        everyN: 0,
        delay: 0,
        healPerTick: 0,
    } as IProps;
}

export function applyAM(actual: IProps, a?: IProps, m?: IProps): IProps {
    return {
        ...actual,
        halfAngle: (actual.halfAngle + (a.halfAngle ?? 0)) * (m.halfAngle ?? 1),
        range: (actual.range + (a.range ?? 0)) * (m.range ?? 1),
        cooldown: (actual.cooldown + (a.cooldown ?? 0)) * (m.cooldown ?? 1),
        damage: (actual.damage + (a.damage ?? 0)) * (m.damage ?? 1),
        duration: (actual.duration + (a.duration ?? 0)) * (m.duration ?? 1),
        knockback: (actual.knockback + (a.knockback ?? 0)) * (m.knockback ?? 1),
        everyN: (actual.everyN + (a.everyN ?? 0)) * (m.everyN ?? 1),
        delay: (actual.delay + (a.delay ?? 0)) * (m.delay ?? 1),
        healPerTick: (actual.healPerTick + (a.healPerTick ?? 0)) * (m.healPerTick ?? 1),
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
