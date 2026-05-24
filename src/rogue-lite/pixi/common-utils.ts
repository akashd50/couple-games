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