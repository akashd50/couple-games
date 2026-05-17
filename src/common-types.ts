import { Role } from "./mirror-sketch/models/game.types";

export interface RoomState {
    code: string;
    sceneId: string | null;
    spectator: boolean;
    players: Player[];
    gameType?: string;
}

export interface Player {
    id: string;
    role: Role | null;
}
