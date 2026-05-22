import type { BlockType } from '../../game.types';

export const BLOCK_TYPES: BlockType[] = [
    {
        kind: 'wood',
        label: 'Wood',
        width: 2,
        height: 1,
        mass: 1,
        color: '#8B6914',
        friction: 0.5,
        density: 0.001,
    },
    {
        kind: 'wood-vert',
        label: 'Wood',
        width: 1,
        height: 2,
        mass: 1,
        color: '#8B6914',
        friction: 0.5,
        density: 0.001,
    },
    {
        kind: 'stone',
        label: 'Stone',
        width: 2,
        height: 1,
        mass: 2,
        color: '#666666',
        friction: 0.6,
        density: 0.003,
    },
    {
        kind: 'stone-vert',
        label: 'Stone',
        width: 1,
        height: 2,
        mass: 2,
        color: '#666666',
        friction: 0.6,
        density: 0.003,
    },
    {
        kind: 'dynamite',
        label: 'Dynamite',
        width: 1,
        height: 1,
        mass: 0.5,
        color: '#CC0000',
        friction: 0.4,
        density: 0.0005,
    },
];

export function getBlockType(kind: string): BlockType {
    return BLOCK_TYPES.find((b) => b.kind === kind)!;
}
