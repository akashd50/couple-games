import { Vec2 } from "./types";

export type Constructor<T> = new (...args: any[]) => T;

/**
 * Linearly interpolates between two numbers.
 *
 * @param start The starting value.
 * @param end The ending value.
 * @param t The interpolation factor (typically between 0 and 1).
 * @returns The interpolated value.
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

/**
 * Wraps an angle (radians) into the range [-π, π].
 * Used for directional comparisons (e.g. shield-side hit detection).
 */
export function wrapAngle(a: number): number {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}

export function getDirectionTo(from: Vec2, to: Vec2): Vec2 {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    return {
        x: dist > 0.001 ? dx / dist : (Math.random() * 2 - 1),
        y: dist > 0.001 ? dy / dist : (Math.random() * 2 - 1)
    };
}