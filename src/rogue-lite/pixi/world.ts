import { Application, Container } from 'pixi.js';
import { buildArena } from './graphics/arena-graphics';
import { Player } from './entities/player';
import { CameraSystem } from './systems/camera-system';
import { InputManager } from './input-manager';
import { ARENA_SIZE, FIXED_STEP, MAX_ACCUMULATED_TIME } from './constants';
import type { Vec2 } from './types';

/**
 * Orchestrates all Pixi entities and systems for a single run.
 *
 * Lifecycle:
 *   const world = new World(app, worldRoot, host, inputManager);
 *   // ... run plays ...
 *   world.destroy();
 */
export class World {
    private readonly player: Player;
    private readonly camera: CameraSystem;
    private accumulator = 0;
    private lastAim: Vec2 = { x: 1, y: 0 };
    private readonly tickerFn: () => void;

    constructor(
        private readonly app: Application,
        worldRoot: Container,
        host: HTMLElement,
        inputManager: InputManager,
    ) {
        // Layers (bottom → top)
        worldRoot.addChild(buildArena());

        const playerLayer = new Container();
        playerLayer.label = 'players';
        worldRoot.addChild(playerLayer);

        // Entities
        this.player = new Player(playerLayer);

        // Camera — start centred on arena, no lerp lag on first frame
        this.camera = new CameraSystem(worldRoot, ARENA_SIZE / 2, ARENA_SIZE / 2);

        // Ticker — fixed-step sim + per-frame camera
        this.tickerFn = () => {
            const rawDt = app.ticker.deltaMS / 1000;
            const cappedDt = Math.min(rawDt, MAX_ACCUMULATED_TIME);

            // Fixed-timestep simulation loop
            this.accumulator += cappedDt;
            while (this.accumulator >= FIXED_STEP) {
                this.accumulator -= FIXED_STEP;
                const { move, aim } = inputManager.read();
                this.lastAim = aim;
                this.player.update(FIXED_STEP, move, Math.atan2(aim.y, aim.x));
            }

            // Camera runs every render frame for smooth interpolation
            this.camera.update(
                rawDt,
                this.player.position,
                this.lastAim,
                host.clientWidth,
                host.clientHeight,
            );
        };

        app.ticker.add(this.tickerFn);
    }

    destroy(): void {
        this.app.ticker.remove(this.tickerFn);
        this.player.destroy();
    }
}
