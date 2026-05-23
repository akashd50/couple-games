import { Role } from "./mirror-sketch/models/game.types";

export type PhaseType = "waiting" | "building" | "playing";

export interface GameInfo {
    phase: PhaseType;
}

export interface RoomState {
    code: string;
    sceneId: string;
    spectator: boolean;
    players: Player[];
    gameType?: string;
    game?: GameInfo;
}

export interface Player {
    id: string;
    role: Role;
    ready: boolean;
}
