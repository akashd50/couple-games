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
    while (a >  Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
}