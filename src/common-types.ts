import { Role } from "./mirror-sketch/models/game.types";

export type PhaseType = "waiting" | "building" | "playing" | 'trivia' | 'battle' | 'finished';
export type GameType = "sling-war" | "rogue-lite" | "mirror-sketch";

export interface GameInfo {
    phase: PhaseType;
}

export interface RoomState {
    code: string;
    sceneId: string;
    spectator: boolean;
    players: Player[];
    gameType?: GameType;
    game?: GameInfo;
    maxPlayers: number;
}

export interface Player {
    id: string;
    role: Role;
    ready: boolean;
    isHost: boolean;
}
