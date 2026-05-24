// ─── Arena ───────────────────────────────────────────────────────────────────
export class ArenaConsts {
    static readonly SIZE             = 4000;
    static readonly GRID_CELL        = 200;
    static readonly BACKGROUND_COLOR = 0x0e0e1a;
}

// ─── Knight (player) ─────────────────────────────────────────────────────────
export class KnightConsts {
    static readonly RADIUS = 22;
    /** World units / second. */
    static readonly SPEED  = 280;
    static readonly COLOR  = 0xe8e8f0;
    static readonly HP     = 100;
    /** Invincibility window after taking a hit (seconds). */
    static readonly IFRAMES = 0.5;

    // ── Shield ──────────────────────────────────────────────────────────────
    static readonly SHIELD_COLOR    = 0x5599ff;
    /** ~45° half-angle on each side. */
    static readonly SHIELD_ARC_HALF = Math.PI / 4;

    // ── Auto-attack ─────────────────────────────────────────────────────────
    static readonly AutoAttack = {
        /** World-unit reach of the sword swing. */
        RANGE:       80,
        /** Half-angle of the 60° cone (30° each side). */
        HALF_ANGLE:  Math.PI / 6,
        /** Seconds between auto-swings. */
        COOLDOWN:    0.65,
        DAMAGE:      30,
        /** How long the visual swing arc stays visible (seconds). */
        ARC_DURATION: 0.18,
        SWORD_COLOR:  0xffcc44,
        /** Knockback impulse applied to an enemy on sword hit (world units/s). */
        KNOCKBACK:    195,
    } as const;
}

// ─── Chaser enemy ────────────────────────────────────────────────────────────
export class ChaserConsts {
    static readonly RADIUS       = 16;
    static readonly HP           = 40;
    static readonly SPEED_WANDER = 55;
    static readonly SPEED_CHASE  = 115;
    /** Distance at which a wandering Chaser switches to chase mode. */
    static readonly AGGRO_RANGE   = 340;
    /** Distance at which a chasing Chaser gives up and reverts to wander. */
    static readonly DEAGGRO_RANGE = 470;
    static readonly COLOR         = 0xcc3333;
    /** Fixed HP damage per contact hit on the player (gated by KnightConsts.IFRAMES). */
    static readonly HIT_DAMAGE    = 15;
    /** Knockback impulse applied to the player on contact hit (world units/s). */
    static readonly KNOCKBACK     = 145;
    /** How many Chasers to spawn when a run starts. */
    static readonly SPAWN_COUNT   = 6;
}

// ─── Camera ──────────────────────────────────────────────────────────────────
export class CameraConsts {
    /** World units toward aim direction. */
    static readonly LOOKAHEAD = 80;
    /** Exponential-decay speed factor. */
    static readonly LERP      = 8;
}

// ─── Physics (shared) ────────────────────────────────────────────────────────
export class PhysicsConsts {
    /** Exponential velocity-decay factor for knockback (higher = faster stop). */
    static readonly KNOCKBACK_FRICTION = 8;
}

// ─── Simulation ──────────────────────────────────────────────────────────────
export class SimConsts {
    /** Seconds per sim tick. */
    static readonly FIXED_STEP           = 1 / 60;
    /** Spiral-of-death cap (seconds). */
    static readonly MAX_ACCUMULATED_TIME = 0.25;
}
