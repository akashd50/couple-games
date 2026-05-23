export const ARENA_SIZE = 4000;
export const GRID_CELL = 200;

export const PLAYER_RADIUS = 22;
export const PLAYER_SPEED = 280; // world units / second
export const PLAYER_COLOR = 0xe8e8f0;
export const SHIELD_COLOR = 0x5599ff;
export const SHIELD_ARC_HALF = Math.PI / 4; // ~45° half-angle on each side

export const CAMERA_LOOKAHEAD = 80; // world units toward aim direction
export const CAMERA_LERP = 8; // exponential-decay speed factor

export const FIXED_STEP = 1 / 60; // seconds per sim tick
export const MAX_ACCUMULATED_TIME = 0.25; // spiral-of-death cap

export const BACKGROUND_COLOR = 0x0e0e1a;
