// ─── Arena ───────────────────────────────────────────────────────────────────
export class ArenaConsts {
    static readonly SIZE = 4000;
    static readonly GRID_CELL = 200;
    static readonly BACKGROUND_COLOR = 0x0e0e1a;
}

export interface PlayerProps {
    radius: number;
    speed: number;
    color: number;
    hp: number;
    iframesAfterDamage: number;
}

export type AttackType = "swing";

export interface AttackProps {
    type: AttackType
    range: number;
    halfAngle: number;
    cooldown: number;
    damage: number;
    duration: number;
    color: number;
    knockback: number;
}

export class KnightProps implements PlayerProps {
    radius = 22;
    speed = 280;
    color = 0xe8e8f0;
    hp = 100;
    iframesAfterDamage = 0.5;

    readonly SHIELD_COLOR = 0x5599ff;
    readonly SHIELD_ARC_HALF = Math.PI / 4;

    autoAttack: AttackProps = {
        type: "swing",
        range: 80,
        /** Half-angle of the 60° cone (30° each side). */
        halfAngle: Math.PI / 6,
        /** Seconds between auto-swings. */
        cooldown: 0.65,
        damage: 30,
        /** How long the visual swing arc stays visible (seconds). */
        duration: 0.18,
        color: 0xffcc44,
        /** Knockback impulse applied to an enemy on sword hit (world units/s). */
        knockback: 195,
    };
}

export const KnightConsts = new KnightProps();

// ─── Chaser enemy ────────────────────────────────────────────────────────────
export class ChaserConsts {
    static readonly RADIUS = 16;
    static readonly HP = 40;
    static readonly SPEED_WANDER = 55;
    static readonly SPEED_CHASE = 115;
    /** Distance at which a wandering Chaser switches to chase mode. */
    static readonly AGGRO_RANGE = 340;
    /** Distance at which a chasing Chaser gives up and reverts to wander. */
    static readonly DEAGGRO_RANGE = 470;
    static readonly COLOR = 0xcc3333;
    /** Fixed HP damage per contact hit on the player (gated by KnightConsts.IFRAMES). */
    static readonly HIT_DAMAGE = 15;
    /** Knockback impulse applied to the player on contact hit (world units/s). */
    static readonly KNOCKBACK = 145;
    /** How many Chasers to spawn when a run starts. */
    static readonly SPAWN_COUNT = 6;
}

// ─── XP gems ─────────────────────────────────────────────────────────────────
export class XpGemConsts {
    /** Visual radius of the gem diamond shape. */
    static readonly RADIUS = 7;
    static readonly COLOR = 0x44ffaa;
    /** World units/s when a gem is being attracted by the Magnet upgrade. */
    static readonly ATTRACTION_SPEED = 420;
    /** Default pickup radius (player must walk within this range to collect). */
    static readonly BASE_PICKUP_RADIUS = 40;
    /** XP awarded per collected gem. */
    static readonly XP_VALUE = 5;
}

// ─── Spawner ──────────────────────────────────────────────────────────────────
export class SpawnerConsts {
    /** Seconds between enemy-count checks. */
    static readonly TICK_INTERVAL = 1.0;
    /** Initial enemy cap when runTime=0. */
    static readonly BASE_COUNT = 6;
    /** Additional enemies unlocked each ramp period. */
    static readonly COUNT_RAMP_STEP = 2;
    /** Seconds between count ramps. */
    static readonly COUNT_RAMP_INTERVAL = 30;
    /** Hard cap on simultaneous enemies. */
    static readonly MAX_COUNT = 30;
    /** Minimum spawn distance from the player (world units). */
    static readonly SPAWN_RING_MIN = 650;
    /** Maximum spawn distance from the player (world units). */
    static readonly SPAWN_RING_MAX = 950;
}

// ─── Level / XP ──────────────────────────────────────────────────────────────
export class LevelConsts {
    /** XP required to reach level N+1 = N * XP_PER_LEVEL. */
    static readonly XP_PER_LEVEL = 20;
    /** Number of upgrade choices offered on level-up. */
    static readonly UPGRADE_CHOICES = 3;
}

// ─── Camera ──────────────────────────────────────────────────────────────────
export class CameraConsts {
    /** World units toward aim direction. */
    static readonly LOOKAHEAD = 80;
    /** Exponential-decay speed factor. */
    static readonly LERP = 8;
}

// ─── Physics (shared) ────────────────────────────────────────────────────────
export class PhysicsConsts {
    /** Exponential velocity-decay factor for knockback (higher = faster stop). */
    static readonly KNOCKBACK_FRICTION = 8;
}

// ─── Simulation ──────────────────────────────────────────────────────────────
export class SimConsts {
    /** Seconds per sim tick. */
    static readonly FIXED_STEP = 1 / 60;
    /** Spiral-of-death cap (seconds). */
    static readonly MAX_ACCUMULATED_TIME = 0.25;
}
