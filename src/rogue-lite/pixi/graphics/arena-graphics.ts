import { Container, Graphics } from 'pixi.js';
import { ArenaConsts } from '../constants';

const BG_COLOR    = 0x111120;
const GRID_COLOR  = 0x1a1a30;
const BORDER_COLOR = 0x334466;

/**
 * Builds a static arena Container: dark background + subtle grid + border.
 * Called once at world init — never cleared or redrawn.
 */
export function buildArena(): Container {
    const container = new Container();
    container.label = 'arena';

    // Background fill
    const bg = new Graphics();
    bg.rect(0, 0, ArenaConsts.SIZE, ArenaConsts.SIZE).fill({ color: BG_COLOR });
    container.addChild(bg);

    // Grid lines (all paths batched into one stroke call)
    const grid = new Graphics();
    for (let x = ArenaConsts.GRID_CELL; x < ArenaConsts.SIZE; x += ArenaConsts.GRID_CELL) {
        grid.moveTo(x, 0).lineTo(x, ArenaConsts.SIZE);
    }
    for (let y = ArenaConsts.GRID_CELL; y < ArenaConsts.SIZE; y += ArenaConsts.GRID_CELL) {
        grid.moveTo(0, y).lineTo(ArenaConsts.SIZE, y);
    }
    grid.stroke({ color: GRID_COLOR, width: 1, alpha: 0.6 });
    container.addChild(grid);

    // Arena border
    const border = new Graphics();
    border.rect(0, 0, ArenaConsts.SIZE, ArenaConsts.SIZE).stroke({ color: BORDER_COLOR, width: 4 });
    container.addChild(border);

    return container;
}
