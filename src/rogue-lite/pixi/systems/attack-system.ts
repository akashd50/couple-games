/**
 * Returns true if a circular target overlaps the sword's swept arc.
 *
 * The arc represents the portion of the swing that has already passed:
 *   arcStart — the leftmost angle (where the sword begins, aimAngle − halfAngle)
 *   arcEnd   — the leading edge of the sword at the current tick
 *              (lerps toward aimAngle + halfAngle as the swing progresses)
 *
 * On the very first tick arcStart ≈ arcEnd (zero-width); it widens each tick
 * until the full cone is covered at the end of the animation.
 *
 * The check is circle-aware: a target partially inside the swept wedge counts
 * as hit.
 *
 * @param attackRange  Effective sword range (world units) — may differ from the
 *                     base constant after Wide Cleave stacks are applied.
 */
export function isInAttackCone(
    attackerX: number,
    attackerY: number,
    arcStart: number,
    arcEnd: number,
    targetX: number,
    targetY: number,
    targetRadius: number,
    attackRange: number,
): boolean {
    const dx   = targetX - attackerX;
    const dy   = targetY - attackerY;
    const dist = Math.hypot(dx, dy);

    // Range check — target centre plus its radius must reach the sword
    if (dist > attackRange + targetRadius) return false;

    // Targets directly on top of the attacker are always hit
    if (dist < 0.001) return true;

    // Angular leniency — extra angle credit for the target's circular body
    const angularLeniency = Math.asin(Math.min(1, targetRadius / dist));

    // Normalise sweepWidth to [0, 2π) so the comparison is always in one direction
    const sweepWidth  = ((arcEnd - arcStart)         % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    // Angular distance from arcStart to the target direction, also in [0, 2π)
    const angleToTarget = Math.atan2(dy, dx);
    const delta         = ((angleToTarget - arcStart) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

    // The target is hit when its angular span overlaps [0, sweepWidth]:
    //   delta ≤ sweepWidth + leniency  → inside or peeking past the leading edge
    //   delta ≥ 2π − leniency          → peeking just before the start edge (wrap-around)
    return delta <= sweepWidth + angularLeniency
        || delta >= 2 * Math.PI - angularLeniency;
}
