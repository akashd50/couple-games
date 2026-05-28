import { ArenaConsts, SpawnerConsts } from '../constants';
import type { Vec2 } from '../types';

/** Enemy types the spawner can request. */
export type SpawnType = 'chaser' | 'tank';

/**
 * Periodically tops up the live enemy count to match `targetCount(runTime)`.
 *
 * Spawn points are chosen on a ring around the player — always outside the
 * visible viewport but within arena bounds.  Enemies ramp up every
 * {@link SpawnerConsts.COUNT_RAMP_INTERVAL} seconds.
 *
 * Phase 5: Tanks begin appearing at {@link SpawnerConsts.TANK_START_TIME}
 * and their share of new spawns ramps linearly to {@link SpawnerConsts.TANK_MAX_RATIO}
 * by {@link SpawnerConsts.TANK_RAMP_TIME}.
 */
export class SpawnerSystem {
    /** Counts down to the next spawn check. Starts at 0 so the first
     *  check fires on the very first tick (fills the arena immediately). */
    private spawnTimer = 0;

    constructor(
        /** Called once per enemy that needs to be spawned this tick. */
        private readonly spawnEnemy: (x: number, y: number, type: SpawnType) => void,
    ) {}

    /**
     * Advance the spawn timer and emit new enemies as needed.
     *
     * @param dt           Fixed sim delta (seconds).
     * @param runTime      Total run time elapsed (seconds) — used to compute ramp.
     * @param currentCount Live enemy count at the start of this tick (bosses excluded).
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
            const type = this.pickType(runTime);
            this.spawnEnemy(pos.x, pos.y, type);
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
     * Choose whether to spawn a Chaser or Tank for this slot.
     *
     * Tank ratio ramps linearly from 0 to {@link SpawnerConsts.TANK_MAX_RATIO}
     * between {@link SpawnerConsts.TANK_START_TIME} and
     * {@link SpawnerConsts.TANK_RAMP_TIME}.
     */
    private pickType(runTime: number): SpawnType {
        const { TANK_START_TIME, TANK_RAMP_TIME, TANK_MAX_RATIO } = SpawnerConsts;
        if (runTime < TANK_START_TIME) return 'chaser';

        const t = Math.min(1, (runTime - TANK_START_TIME) / (TANK_RAMP_TIME - TANK_START_TIME));
        const tankRatio = t * TANK_MAX_RATIO;

        return Math.random() < tankRatio ? 'tank' : 'chaser';
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
