import { ArenaConsts, EnemyLevelConsts, SpawnerConsts } from '../constants';
import type { Vec2 } from '../types';

/** Enemy types the spawner can request. */
export type SpawnType = 'chaser' | 'tank';

/**
 * Periodically tops up the live enemy count to match `targetCount(runTime)`.
 *
 * Spawn points are chosen on a ring around the player — always outside the
 * visible viewport but within arena bounds.  Both the enemy cap and the tank
 * mix ratio are derived from the current enemy level
 * (see {@link EnemyLevelConsts.levelFromTime}) so all difficulty scaling uses
 * a single unified timeline.
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

        const level = EnemyLevelConsts.levelFromTime(runTime);
        const target = this.targetCount(level);
        const toSpawn = Math.max(0, target - currentCount);
        for (let i = 0; i < toSpawn; i++) {
            const pos = this.pickSpawnPoint(playerX, playerY);
            const type = this.pickType(level);
            this.spawnEnemy(pos.x, pos.y, type);
        }
    }

    // ── Private ──────────────────────────────────────────────────────────────

    /**
     * Enemy cap derived from the current enemy level:
     *   `BASE_COUNT + (level − 1) * COUNT_RAMP_STEP`, capped at MAX_COUNT.
     */
    private targetCount(level: number): number {
        return Math.min(
            SpawnerConsts.BASE_COUNT + (level - 1) * SpawnerConsts.COUNT_RAMP_STEP,
            SpawnerConsts.MAX_COUNT,
        );
    }

    /**
     * Choose whether to spawn a Chaser or Tank for this slot.
     *
     * Tank ratio ramps linearly from 0 to {@link SpawnerConsts.TANK_MAX_RATIO}
     * between {@link SpawnerConsts.TANK_START_LEVEL} and
     * {@link SpawnerConsts.TANK_FULL_RATIO_LEVEL}.
     */
    private pickType(level: number): SpawnType {
        const { TANK_START_LEVEL, TANK_FULL_RATIO_LEVEL, TANK_MAX_RATIO } = SpawnerConsts;
        if (level < TANK_START_LEVEL) return 'chaser';

        const t = Math.min(1, (level - TANK_START_LEVEL) / (TANK_FULL_RATIO_LEVEL - TANK_START_LEVEL));
        return Math.random() < t * TANK_MAX_RATIO ? 'tank' : 'chaser';
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
