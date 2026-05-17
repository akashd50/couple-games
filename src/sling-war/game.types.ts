// Sling War — game type definitions.

export type SlingWarPhase = 'waiting' | 'building' | 'trivia' | 'battle' | 'finished';

export interface SlingWarGame {
  phase: SlingWarPhase;
  layouts: { p1: BlockPlacement[]; p2: BlockPlacement[] };
  p1Ready: boolean;
  p2Ready: boolean;
  triviaTurn: 'p1' | 'p2';
  triviaAsked: boolean;
  p1Awarded: boolean;
  p2Awarded: boolean;
  p1Points: number;
  p2Points: number;
  p1PowerUps: number;
  p2PowerUps: number;
  p1HeartDestroyed: boolean;
  p2HeartDestroyed: boolean;
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

export const BLOCK_KINDS = ['wood', 'stone', 'dynamite'] as const;
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
