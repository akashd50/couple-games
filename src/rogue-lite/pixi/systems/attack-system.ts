import { ATTACK_HALF_ANGLE, ATTACK_RANGE } from '../constants';

/**
 * Returns true if a circular target is within the Knight's attack cone.
 *
 * The cone has:
 *   - origin at (attackerX, attackerY)
 *   - axis along aimAngle
 *   - half-angle of ATTACK_HALF_ANGLE (30°)
 *   - reach of ATTACK_RANGE world units
 *
 * The check is circle-aware: a target partially inside the cone counts as hit.
 */
export function isInAttackCone(
    attackerX: number,
    attackerY: number,
    aimAngle: number,
    targetX: number,
    targetY: number,
    targetRadius: number,
): boolean {
    const dx = targetX - attackerX;
    const dy = targetY - attackerY;
    const dist = Math.hypot(dx, dy);

    // Distance check — target centre plus its radius must reach the cone
    if (dist > ATTACK_RANGE + targetRadius) return false;

    // Targets directly on top of the attacker are always hit
    if (dist < 0.001) return true;

    // Angle check — compute angular difference between aim and target direction,
    // then add angular leniency proportional to how much of the target circle
    // could poke into the cone from the side.
    const angleToTarget = Math.atan2(dy, dx);
    let delta = angleToTarget - aimAngle;

    // Normalise to [-π, π]
    delta = ((delta + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

    // Leniency: extra angle "credit" for the target's radius
    const angularLeniency = Math.asin(Math.min(1, targetRadius / dist));

    return Math.abs(delta) <= ATTACK_HALF_ANGLE + angularLeniency;
}
