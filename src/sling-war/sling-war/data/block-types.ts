import type { BlockType } from '../../game.types';

export const BLOCK_TYPES: BlockType[] = [
  {
    kind: 'wood',
    label: 'Wood',
    width: 60,
    height: 30,
    mass: 1,
    color: '#8B6914',
    friction: 0.5,
    density: 0.001,
  },
  {
    kind: 'stone',
    label: 'Stone',
    width: 60,
    height: 30,
    mass: 2,
    color: '#666666',
    friction: 0.6,
    density: 0.003,
  },
  {
    kind: 'dynamite',
    label: 'Dynamite',
    width: 30,
    height: 30,
    mass: 0.5,
    color: '#CC0000',
    friction: 0.4,
    density: 0.0005,
  },
];

export function getBlockType(kind: string): BlockType {
  return BLOCK_TYPES.find((b) => b.kind === kind)!;
}
