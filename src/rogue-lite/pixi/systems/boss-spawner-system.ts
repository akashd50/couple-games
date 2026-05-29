import { ArenaConsts, BossSpawnerConsts, SpawnerConsts } from '../constants';
import { Vec2 } from '../types';

/**
 * Tracks fixed-time thresholds and triggers boss spawns.
 *
 * Rules:
 *   - Boss attempts to spawn every {@link BossSpawnerConsts.SPAWN_INTERVAL} seconds.
 *   - If a boss is still alive when the threshold is crossed, the spawn is
 *     deferred — the threshold does NOT advance.  As soon as the boss dies the
 *     next call to update() will fire immediately.
 *   - Only one boss is ever alive at a time.
 *
 * Usage:
 *   const spawner = new BossSpawnerSystem();
 *   // each tick:
 *   spawner.update(runTime, isBossAlive, (x, y) => spawnBoss(x, y));
 */
export class BossSpawnerSystem {
    /** The next runTime (seconds) at which a boss will be attempted. */
    private nextThreshold = BossSpawnerConsts.SPAWN_INTERVAL;
    /** Whether the threshold has been crossed at least once (avoids repeated logging). */
    private thresholdPending = false;

    /**
     * Check whether a boss should spawn this tick.
     *
     * @param runTime         Total seconds elapsed in this run.
     * @param isBossAlive     True if a boss is currently alive.
     * @param playerX         Player world X — used to pick a spawn point on the ring.
     * @param playerY         Player world Y.
     * @param spawnCallback   Called once with the boss's chosen world (x, y) position.
     */
    update(
        runTime: number,
        isBossAlive: boolean,
        playerX: number,
        playerY: number,
        spawnCallback: (x: number, y: number) => void,
    ): void {
        if (runTime < this.nextThreshold) return;

        // Threshold crossed — attempt a spawn
        if (!isBossAlive) {
            const pos = this.pickSpawnPoint(playerX, playerY);
            spawnCallback(pos.x, pos.y);
            this.nextThreshold += BossSpawnerConsts.SPAWN_INTERVAL;
            this.thresholdPending = false;
        } else {
            // Boss still alive — hold threshold, retry next tick
            this.thresholdPending = true;
        }
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /**
     * Pick a spawn point on the off-screen ring (same ring logic as SpawnerSystem).
     * Falls back to the arena-mirrored position if the player is in a corner.
     */
    private pickSpawnPoint(playerX: number, playerY: number): Vec2 {
        const margin = 80;
        const maxXY = ArenaConsts.SIZE - margin;

        for (let attempt = 0; attempt < 16; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = SpawnerConsts.SPAWN_RING_MIN
                + Math.random() * (SpawnerConsts.SPAWN_RING_MAX - SpawnerConsts.SPAWN_RING_MIN);
            const x = playerX + Math.cos(angle) * dist;
            const y = playerY + Math.sin(angle) * dist;
            if (x >= margin && x <= maxXY && y >= margin && y <= maxXY) {
                return new Vec2(x, y);
            }
        }

        // Fallback: mirror player across arena centre
        return new Vec2(Math.max(margin, Math.min(maxXY, ArenaConsts.SIZE - playerX)), Math.max(margin, Math.min(maxXY, ArenaConsts.SIZE - playerY)));
    }
}
