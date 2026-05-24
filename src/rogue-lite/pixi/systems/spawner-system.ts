import { ArenaConsts, SpawnerConsts } from '../constants';
import type { Vec2 } from '../types';

/**
 * Periodically tops up the live enemy count to match `targetCount(runTime)`.
 *
 * Spawn points are chosen on a ring around the player — always outside the
 * visible viewport but within arena bounds.  Enemies ramp up every
 * {@link SpawnerConsts.COUNT_RAMP_INTERVAL} seconds.
 */
export class SpawnerSystem {
    /** Counts down to the next spawn check. Starts at 0 so the first
     *  check fires on the very first tick (fills the arena immediately). */
    private spawnTimer = 0;

    constructor(
        /** Called once per enemy that needs to be spawned this tick. */
        private readonly spawnChaser: (x: number, y: number) => void,
    ) {}

    /**
     * Advance the spawn timer and emit new Chasers as needed.
     *
     * @param dt           Fixed sim delta (seconds).
     * @param runTime      Total run time elapsed (seconds) — used to compute ramp.
     * @param currentCount Live enemy count at the start of this tick.
     * @param playerX      Player world X — centre of the spawn ring.
     * @param playerY      Player world Y.
     */
    update(
        dt: number,
        runTime: number,
        currentCount: number,
        playerX: number,
        playerY: number,
    ): void {
        this.spawnTimer -= dt;
        if (this.spawnTimer > 0) return;
        this.spawnTimer += SpawnerConsts.TICK_INTERVAL;

        const target = this.targetCount(runTime);
        const toSpawn = Math.max(0, target - currentCount);
        for (let i = 0; i < toSpawn; i++) {
            const pos = this.pickSpawnPoint(playerX, playerY);
            this.spawnChaser(pos.x, pos.y);
        }
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /**
     * Enemy cap that grows over time:
     *   `BASE_COUNT + floor(runTime / RAMP_INTERVAL) * RAMP_STEP`, capped at MAX.
     */
    private targetCount(runTime: number): number {
        const ramps = Math.floor(runTime / SpawnerConsts.COUNT_RAMP_INTERVAL);
        return Math.min(
            SpawnerConsts.BASE_COUNT + ramps * SpawnerConsts.COUNT_RAMP_STEP,
            SpawnerConsts.MAX_COUNT,
        );
    }

    /**
     * Attempts up to 12 random angles on the spawn ring; returns the first
     * point that fits inside the arena margin.  Falls back to the arena-mirrored
     * position if every attempt fails (e.g., the player is in a corner).
     */
    private pickSpawnPoint(playerX: number, playerY: number): Vec2 {
        const margin = 50;
        const maxXY = ArenaConsts.SIZE - margin;

        for (let attempt = 0; attempt < 12; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist =
                SpawnerConsts.SPAWN_RING_MIN +
                Math.random() * (SpawnerConsts.SPAWN_RING_MAX - SpawnerConsts.SPAWN_RING_MIN);
            const x = playerX + Math.cos(angle) * dist;
            const y = playerY + Math.sin(angle) * dist;
            if (x >= margin && x <= maxXY && y >= margin && y <= maxXY) {
                return { x, y };
            }
        }

        // Fallback: mirror the player across the arena centre
        return {
            x: Math.max(margin, Math.min(maxXY, ArenaConsts.SIZE - playerX)),
            y: Math.max(margin, Math.min(maxXY, ArenaConsts.SIZE - playerY)),
        };
    }
}
