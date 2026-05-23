import { Application, Container } from 'pixi.js';
import { InputManager } from './input-manager';
import { World } from './world';
import type { Vec2 } from './types';

const BACKGROUND_COLOR = 0x0e0e1a;

export class GameRenderer {
    private app: Application | null = null;
    private host: HTMLElement | null = null;
    private worldRoot: Container | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private world: World | null = null;
    private inputManager: InputManager | null = null;

    /** True if the current device is touch-primary (available after init). */
    isTouchDevice = false;

    async init(host: HTMLElement): Promise<void> {
        if (this.app) return;
        this.host = host;

        const app = new Application();
        await app.init({
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            resizeTo: host,
            background: BACKGROUND_COLOR,
        });
        host.appendChild(app.canvas);
        this.app = app;

        const worldRoot = new Container();
        worldRoot.label = 'world';
        app.stage.addChild(worldRoot);
        this.worldRoot = worldRoot;

        const inputManager = new InputManager();
        inputManager.attach(host);
        this.inputManager = inputManager;

        this.isTouchDevice = InputManager.isTouchDevice();

        this.world = new World(app, worldRoot, host, inputManager);

        this.resizeObserver = new ResizeObserver(() => {
            app.resize();
        });
        this.resizeObserver.observe(host);
    }

    /** Called by the left joystick Angular component (touch devices). */
    setTouchMove(v: Vec2 | null): void {
        this.inputManager?.setTouchMove(v);
    }

    /** Called by the right joystick Angular component (touch devices). */
    setTouchAim(v: Vec2 | null): void {
        this.inputManager?.setTouchAim(v);
    }

    destroy(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;

        this.world?.destroy();
        this.world = null;

        this.inputManager?.detach();
        this.inputManager = null;

        if (this.app) {
            this.app.destroy(true, { children: true });
            this.app = null;
        }
        this.worldRoot = null;
        this.host = null;
    }
}
