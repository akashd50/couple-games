// ─── Enemy level (time-based difficulty) ─────────────────────────────────────
/**
 * Converts run-time to a discrete enemy level used by every enemy type to
 * derive its HP, speed, and XP gem value.  Level is independent of player
 * level — it is purely a function of elapsed run time.
 *
 * Level 1 at t = 0 s, then +1 every SECONDS_PER_LEVEL.
 */
export class EnemyLevelConsts {
    /** Seconds of run time per enemy-level increment. */
    static readonly SECONDS_PER_LEVEL = 30;
    /** Hard cap so stats don't explode in very long runs. */
    static readonly MAX_LEVEL = 20;

    /** Compute the current enemy level from elapsed run time. */
    static levelFromTime(runTime: number): number {
        return Math.min(
            1 + Math.floor(runTime / EnemyLevelConsts.SECONDS_PER_LEVEL),
            EnemyLevelConsts.MAX_LEVEL,
        );
    }
}

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

export type PropsType = "swing" | "aura" | "sword_shockwave" | "sword_shockwave_aftershock" | "healTick";

export interface IProps {
    type?: PropsType
    range?: number;
    halfAngle?: number;
    cooldown?: number;
    damage?: number;
    duration?: number;
    color?: number;
    knockback?: number;
    everyN?: number;
    delay?: number;
    healPerTick?: number;
}

export class KnightProps implements PlayerProps {
    radius = 22;
    speed = 280;
    color = 0xe8e8f0;
    hp = 100;
    iframesAfterDamage = 0.5;

    readonly SHIELD_COLOR = 0x5599ff;
    readonly SHIELD_ARC_HALF = Math.PI / 4;

    // ── Basic sword swing ──────────────────────────────────────────────────────────
    swing: IProps = {
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

    // ── Aura upgrade ──────────────────────────────────────────────────────────
    aura: IProps = {
        type: "aura",
        range: 100,
        duration: 2.0,
        damage: 8,
        knockback: 200,
        color: 0x88ff88,
        cooldown: 2.0,
    };

    swordShockwave: IProps = {
        type: "sword_shockwave",
        /** Every N attacks fires a Shockwave. */
        everyN: 5,
        range: 220,
        /** Knockback impulse (world units/s) applied by the primary Shockwave. */
        knockback: 350,
        color: 0x88aaff,
        duration: 0.38,
        damage: 5
    };

    aftershock: IProps = {
        type: "sword_shockwave_aftershock",
        delay: 0.5,
        range: 140,
        knockback: 220,
        color: 0xD1A96B,
        duration: 0.2,
        damage: 5
    };

    healTick: IProps = {
        type: "healTick",
        healPerTick: 0.0,
        cooldown: 1,
        color: 0x0000FF,
    };

    // ── Directional speed bonus ───────────────────────────────────────────────
    /**
     * Maximum fractional speed bonus gained when the player's movement direction
     * perfectly matches the aim direction.  Applied proportionally to the dot
     * product: facing 90° off = 0 bonus; facing exactly the same = +30%.
     */
    readonly DIRECTIONAL_SPEED_BONUS = 0.30;

    // ── Shield-side damage reduction ──────────────────────────────────────────
    /**
     * Base fraction of incoming damage blocked when a hit arrives from the
     * shield-facing side (within ±SHIELD_ARC_HALF of the aim direction).
     * The Aura Shield upgrade stacks on top of this.
     */
    readonly SHIELD_BASE_REDUCTION = 0.20;
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

    // ── Level-based scaling ───────────────────────────────────────────────────
    /**
     * Fractional HP increase per enemy level above 1.
     * Level 1 → ×1.00 | Level 5 → ×1.60 | Level 10 → ×2.35
     */
    static readonly HP_SCALE_PER_LEVEL = 0.15;
    /**
     * Fractional speed increase per enemy level above 1.
     * Level 5 → ×1.28 — faster but not overwhelming.
     */
    static readonly SPEED_SCALE_PER_LEVEL = 0.07;
    /** Base XP value of each gem dropped at level 1. */
    static readonly XP_VALUE_BASE = 10;
    /** Additional XP per gem awarded per level above 1. */
    static readonly XP_VALUE_PER_LEVEL = 2;
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
    static readonly XP_VALUE = 10;
}

// ─── Tank enemy ───────────────────────────────────────────────────────────────
export class TankConsts {
    static readonly RADIUS = 22;
    static readonly HP = 100;
    static readonly SPEED_WANDER = 35;
    static readonly SPEED_CHASE = 75;
    /** Distance at which a wandering Tank aggros. */
    static readonly AGGRO_RANGE = 380;
    /** Distance at which a chasing Tank de-aggros. */
    static readonly DEAGGRO_RANGE = 520;
    static readonly COLOR = 0x5566ff;
    /** Outline color of the square body. */
    static readonly OUTLINE_COLOR = 0x99aaff;
    static readonly HIT_DAMAGE = 25;
    static readonly KNOCKBACK = 220;
    /** XP gems dropped on death (Tanks are worth more than Chasers). */
    static readonly XP_DROP_COUNT = 3;

    // ── Level-based scaling ───────────────────────────────────────────────────
    /** Fractional HP increase per enemy level above 1. */
    static readonly HP_SCALE_PER_LEVEL = 0.15;
    /** Fractional speed increase per enemy level above 1. */
    static readonly SPEED_SCALE_PER_LEVEL = 0.07;
    /** Base XP value of each gem dropped at level 1. */
    static readonly XP_VALUE_BASE = 15;
    /** Additional XP per gem awarded per level above 1. */
    static readonly XP_VALUE_PER_LEVEL = 3;
}

// ─── Hexagon Boss ─────────────────────────────────────────────────────────────
export class HexBossConsts {
    static readonly RADIUS = 40;
    static readonly HP = 500;
    static readonly COLOR = 0xcc2200;
    static readonly OUTLINE_COLOR = 0xff6644;
    /** Movement speed while charging. */
    static readonly SPEED_CHARGE = 145;
    /** Contact damage dealt to the player. */
    static readonly HIT_DAMAGE = 35;
    /** Knockback impulse applied to the player on contact. */
    static readonly KNOCKBACK = 280;
    /** XP gems spawned in a burst on boss death. */
    static readonly XP_DROP_COUNT = 12;
    /** HP restored to the player when the boss is killed. */
    static readonly HEAL_ON_KILL = 20;
    /** Number of projectiles in each radial burst. */
    static readonly BURST_COUNT = 8;

    // ── State-machine durations (seconds) ────────────────────────────────────
    static readonly CHARGE_DURATION = 3.0;
    static readonly TELEGRAPH_DURATION = 0.55;
    static readonly RECOVER_DURATION = 1.1;

    // ── How far the boss gets knocked back relative to received impulse ───────
    /** Multiplier on incoming knockback (boss is heavy). */
    static readonly KNOCKBACK_RECEIVED_MULT = 0.25;

    // ── Level-based scaling ───────────────────────────────────────────────────
    /**
     * Fractional HP increase per enemy level above 1.
     * Boss at level 5 (120 s): 500 × 1.80 = 900 HP.
     * Boss at level 9 (240 s): 500 × 2.60 = 1 300 HP.
     */
    static readonly HP_SCALE_PER_LEVEL = 0.20;
    /** Base XP value per gem dropped at level 1. */
    static readonly XP_VALUE_BASE = 30;
    /** Additional XP per gem awarded per level above 1. */
    static readonly XP_VALUE_PER_LEVEL = 5;
}

// ─── Boss spawner ─────────────────────────────────────────────────────────────
export class BossSpawnerConsts {
    /** Seconds between boss-spawn attempts. */
    static readonly SPAWN_INTERVAL = 120;
}

// ─── Projectile ───────────────────────────────────────────────────────────────
export class ProjectileConsts {
    static readonly SPEED = 320;
    static readonly DAMAGE = 20;
    static readonly KNOCKBACK = 350;
    static readonly RADIUS = 10;
    static readonly LIFETIME = 4.0;
    static readonly COLOR = 0xff5522;
}

// ─── VFX ─────────────────────────────────────────────────────────────────────
export class VfxConsts {
    /** Screenshake intensity (world units of random offset). */
    static readonly SHAKE_INTENSITY = 8;
    /** Duration of screenshake in seconds. */
    static readonly SHAKE_DURATION = 0.35;
    /** Default particle burst count for regular enemies. */
    static readonly DEATH_PARTICLE_COUNT = 8;
    /** Particle burst count for the boss. */
    static readonly BOSS_DEATH_PARTICLE_COUNT = 24;
    /** How far boss XP gems are scattered on death (world units). */
    static readonly BOSS_GEM_SCATTER_RADIUS = 80;
}

// ─── Spawner ──────────────────────────────────────────────────────────────────
export class SpawnerConsts {
    /** Seconds between enemy-count checks. */
    static readonly TICK_INTERVAL = 1.0;
    /** Initial enemy cap at enemy level 1. */
    static readonly BASE_COUNT = 10;
    /** Additional enemies added to the cap per enemy level above 1. */
    static readonly COUNT_RAMP_STEP = 5;
    /** Hard cap on simultaneous enemies (bosses are counted separately). */
    static readonly MAX_COUNT = 60;
    /** Minimum spawn distance from the player (world units). */
    static readonly SPAWN_RING_MIN = 650;
    /** Maximum spawn distance from the player (world units). */
    static readonly SPAWN_RING_MAX = 950;

    // ── Tank mix (level-based) ────────────────────────────────────────────────
    /**
     * Enemy level at which Tanks first appear in the spawn pool.
     * Equivalent to ~60 s with SECONDS_PER_LEVEL = 30 (level = 1 + 60/30 = 3).
     */
    static readonly TANK_START_LEVEL = 3;
    /**
     * Enemy level at which the Tank ratio reaches its maximum.
     * Equivalent to ~180 s (level = 1 + 180/30 = 7).
     */
    static readonly TANK_FULL_RATIO_LEVEL = 7;
    /** Maximum fraction of new spawns that can be Tanks (0.30 = 30%). */
    static readonly TANK_MAX_RATIO = 0.30;
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

// ─── Summoner player ─────────────────────────────────────────────────────────
export class SummonerProps implements PlayerProps {
    radius = 18;
    speed = 300;
    color = 0x9944cc;   // deep purple
    hp = 80;
    iframesAfterDamage = 0.5;

    // ── Projectile auto-attack ─────────────────────────────────────────────────
    /** Seconds between projectile shots. */
    readonly PROJ_COOLDOWN = 0.55;
    readonly PROJ_DAMAGE   = 22;
    /** World units / second. */
    readonly PROJ_SPEED    = 420;
    /** Knockback impulse (world units/s) on hit. */
    readonly PROJ_KNOCKBACK = 110;
    /** Collision radius of each bullet. */
    readonly PROJ_RADIUS   = 6;
    /** Seconds before a bullet expires. */
    readonly PROJ_LIFETIME = 2.2;
    /** Bright glowing-purple fill colour. */
    readonly PROJ_COLOR    = 0xcc55ff;
    /** Trail colour (slightly darker). */
    readonly PROJ_TRAIL_COLOR = 0x8822bb;

    // ── Summon area ────────────────────────────────────────────────────────────
    /** World-unit radius of the corpse-detection / summon area circle. */
    readonly SUMMON_RADIUS = 190;
    /** Seconds between auto-summon attempts. */
    readonly SUMMON_COOLDOWN = 3.0;
    /** Starting minion capacity. */
    readonly BASE_MINION_CAP = 3;
}

export const SummonerConsts = new SummonerProps();

// ─── Minion (Summoner's friendly units) ──────────────────────────────────────
export class MinionConsts {
    /** Half-side of the square body (world units). */
    static readonly BASE_RADIUS  = 9;
    /** HP at level 1. */
    static readonly BASE_HP      = 30;
    /** Additional HP per enemy level above 1. */
    static readonly HP_PER_LEVEL = 10;
    /** Movement speed (world units/s). */
    static readonly SPEED        = 195;
    /**
     * Distance from the Summoner within which the minion will peel off to
     * attack a nearby enemy (rather than continuing to follow).
     */
    static readonly FOLLOW_RANGE   = 340;
    /** Attack-reach distance from the target's centre. */
    static readonly ATTACK_RANGE   = 55;
    /** Base HP damage per minion hit. */
    static readonly ATTACK_DAMAGE  = 15;
    /** Additional damage per minion level above 1. */
    static readonly DAMAGE_PER_LEVEL = 3;
    /** Seconds between attacks. */
    static readonly ATTACK_COOLDOWN = 1.0;
    /** Knockback impulse applied to the target on hit (world units/s). */
    static readonly ATTACK_KNOCKBACK = 80;
    /** Fraction of enemy contactDamage that a minion takes on body contact. */
    static readonly CONTACT_DAMAGE_MULT = 0.25;
    /** Iframes given to a minion after taking contact damage (seconds). */
    static readonly IFRAMES = 0.55;

    static readonly COLOR         = 0x7722aa;
    static readonly OUTLINE_COLOR = 0xcc88ff;
}

// ─── Corpse node (Summoner sees these on enemy death) ────────────────────────
export class CorpseConsts {
    /** Seconds before a corpse fades out on its own. */
    static readonly LIFETIME    = 4.5;
    /** Collision radius used for proximity checks. */
    static readonly RADIUS      = 14;
    /** Base dark fill colour. */
    static readonly COLOR       = 0x2a2040;
    /** Centre mark colour. */
    static readonly MARK_COLOR  = 0x6633aa;
    /** Alpha when freshly spawned (fades to 0 over LIFETIME). */
    static readonly ALPHA_START = 0.70;
}

// ─── Summoner's summon-area visual ───────────────────────────────────────────
export class SummonAreaConsts {
    /** Starting minion cap (duplicated here for readability). */
    static readonly BASE_MINION_CAP = 3;
    /** Auto-summon cooldown (matches SummonerConsts). */
    static readonly COOLDOWN        = 3.0;
    /** Very dark violet for the disc fill. */
    static readonly COLOR           = 0x1a0033;
    /** Slightly brighter violet for the outline stroke. */
    static readonly OUTLINE_COLOR   = 0x7700cc;
    /** Alpha for the disc fill. */
    static readonly ALPHA           = 0.18;
    /** Alpha for the outline ring. */
    static readonly OUTLINE_ALPHA   = 0.55;
}

// ─── Dust clouds (both player classes) ───────────────────────────────────────
export class DustCloudConsts {
    /** Seconds each cloud lives. */
    static readonly LIFETIME      = 0.45;
    /** Starting visual radius of the puff. */
    static readonly RADIUS        = 9;
    /** Starting alpha (fades to 0). */
    static readonly ALPHA_START   = 0.28;
    /** Seconds between puff emissions while moving. */
    static readonly EMIT_INTERVAL = 0.10;
    /**
     * Minimum effective movement speed (world units/s) required to emit.
     * Prevents clouds when the player is standing still or against a wall.
     */
    static readonly MIN_SPEED     = 25;

    /** Soft lavender — used by KnightPlayer. */
    static readonly KNIGHT_COLOR   = 0xc4aaff;
    /** More vivid purple — used by SummonerPlayer. */
    static readonly SUMMONER_COLOR = 0xcc66ff;
}
