export interface Vec2 {
    x: number;
    y: number;
}

export interface InputState {
    /** Normalized movement vector (magnitude 0..1). */
    move: Vec2;
    /** Normalized aim unit vector. Defaults to {x:1, y:0} (right) when no input. */
    aim: Vec2;
}

/** Live snapshot of run state passed from World → GameRenderer → Angular HUD. */
export interface RunState {
    playerHp: number;
    maxPlayerHp: number;
    /** Seconds elapsed since the run started. */
    runTime: number;
    runEnded: boolean;
}

/** A single upgrade option presented in the level-up modal. */
export interface UpgradeChoice {
    id: string;
    name: string;
    description: string;
    currentStacks: number;
    maxStacks: number;
}

/**
 * Callback hooks the World calls when important state changes.
 * Stored on the WorldCallbacks object which is shared by reference between
 * GameRenderer and World, so callbacks set after World construction are
 * automatically visible to the World.
 */
export interface WorldCallbacks {
    onHpChange?: (hp: number, maxHp: number) => void;
    onRunEnd?: () => void;
    /**
     * Fired when the player levels up and upgrades are available.
     * The sim is paused until World.selectUpgrade() is called.
     */
    onLevelUp?: (level: number, choices: UpgradeChoice[]) => void;
    /** Fired whenever XP changes (gem collected or level-up overflow). */
    onXpChange?: (xp: number, xpToNext: number, level: number) => void;
}
