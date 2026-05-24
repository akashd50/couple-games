// ─── Arena ───────────────────────────────────────────────────────────────────
export const ARENA_SIZE = 4000;
export const GRID_CELL = 200;

// ─── Player movement ─────────────────────────────────────────────────────────
export const PLAYER_RADIUS = 22;
export const PLAYER_SPEED = 280; // world units / second
export const PLAYER_COLOR = 0xe8e8f0;
export const SHIELD_COLOR = 0x5599ff;
export const SHIELD_ARC_HALF = Math.PI / 4; // ~45° half-angle on each side

// ─── Player HP ───────────────────────────────────────────────────────────────
export const PLAYER_HP = 100;
/** Invincibility window after taking a hit (seconds). */
export const PLAYER_IFRAMES = 0.5;

// ─── Knight auto-attack ──────────────────────────────────────────────────────
/** World-unit reach of the sword swing. */
export const ATTACK_RANGE = 80;
/** Half-angle of the 60° cone (30° each side). */
export const ATTACK_HALF_ANGLE = Math.PI / 6;
/** Seconds between auto-swings. */
export const ATTACK_COOLDOWN = 0.65;
export const ATTACK_DAMAGE = 30;
/** How long the visual swing arc stays visible (seconds). */
export const ATTACK_ARC_DURATION = 0.18;
export const SWORD_COLOR = 0xffcc44;
/** Knockback impulse applied to an enemy on sword hit (world units/s). */
export const ATTACK_KNOCKBACK = 195;

// ─── Knockback (shared) ──────────────────────────────────────────────────────
/** Exponential velocity-decay factor for knockback (higher = faster stop). */
export const KNOCKBACK_FRICTION = 8;

// ─── Chaser enemy ────────────────────────────────────────────────────────────
export const CHASER_RADIUS = 16;
export const CHASER_HP = 40;
export const CHASER_SPEED_WANDER = 55;
export const CHASER_SPEED_CHASE = 115;
/** Distance at which a wandering Chaser switches to chase mode. */
export const CHASER_AGGRO_RANGE = 340;
/** Distance at which a chasing Chaser gives up and reverts to wander. */
export const CHASER_DEAGGRO_RANGE = 470;
export const CHASER_COLOR = 0xcc3333;
/** Fixed HP damage per contact hit on the player (gated by PLAYER_IFRAMES). */
export const CHASER_HIT_DAMAGE = 15;
/** Knockback impulse applied to the player on contact hit (world units/s). */
export const CHASER_KNOCKBACK = 145;
/** How many Chasers to spawn when a run starts. */
export const CHASER_SPAWN_COUNT = 6;

// ─── Camera ──────────────────────────────────────────────────────────────────
export const CAMERA_LOOKAHEAD = 80; // world units toward aim direction
export const CAMERA_LERP = 8;       // exponential-decay speed factor

// ─── Game loop ───────────────────────────────────────────────────────────────
export const FIXED_STEP = 1 / 60;          // seconds per sim tick
export const MAX_ACCUMULATED_TIME = 0.25;  // spiral-of-death cap

export const BACKGROUND_COLOR = 0x0e0e1a;
