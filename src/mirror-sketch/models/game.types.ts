export type Role = 'drawer' | 'describer' | "player1" | "player2";

export interface Player {
    id: string;
    role: Role | null;
}

export interface RoomState {
    code: string;
    sceneId: string | null;
    // Whether the describer wants to watch the live drawing (false = surprise mode).
    spectator: boolean;
    players: Player[];
    // Sling War game state (only present in sling-war rooms).
    game?: Record<string, unknown>;
    gameType?: string;
}

export interface GameStartedPayload {
    sceneId: string | null;
    spectator: boolean;
}

export type StrokePhase = 'start' | 'move' | 'end';

// Coordinates are normalized 0..1 so they scale across screen sizes.
export interface DrawStroke {
    phase: StrokePhase;
    x: number;
    y: number;
    color: string;
    size: number;
    // Stroke id groups start/move/end events from a single touch.
    strokeId: number;
}

export interface Scene {
    id: string;
    title: string;
    // Inline SVG markup served to the describer as a reference.
    svg: string;
}

export interface AckResponse<T = unknown> {
    ok: boolean;
    error?: string;
    code?: string;
    you?: string;
    state?: RoomState;
    data?: T;
}
