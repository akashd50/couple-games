// Sling War — game type definitions.

import { GameInfo, Player, RoomState } from "../common-types";

export interface SlingWarRoomState extends RoomState {
    game?: SlingWarGame;
    players: SlingWarGamePlayer[];
}

export interface SlingWarGamePlayer extends Player {
    layout: BlockPlacement[];
    awarded: boolean;
    points: boolean;
    powerUps: number;
    heartsDestroyed: number;
}

export interface SlingWarGame extends GameInfo {
    triviaTurn: 'p1' | 'p2';
    triviaAsked: boolean;
    battleActive: boolean;
    battleResult: 'p1_wins' | 'p2_wins' | null;
}

export interface BlockPlacement {
    id: string;
    type: BlockKind;
    x: number;
    y: number;
    rotation: number;
}

export const BLOCK_KINDS = ['wood', 'wood-vert', 'stone', 'stone-vert', 'dynamite'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export interface BlockType {
    kind: BlockKind;
    label: string;
    width: number;
    height: number;
    mass: number;
    color: string;
    friction: number;
    density: number;
}

export interface PowerUp {
    id: string;
    label: string;
    description: string;
    cost: number;
    projectileType: ProjectileKind;
}

export const PROJECTILE_KINDS = ['normal', 'heavy', 'explosive'] as const;
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number];
