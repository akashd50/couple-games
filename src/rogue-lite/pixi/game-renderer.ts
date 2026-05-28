import { Application, Container } from 'pixi.js';
import { InputManager } from './input-manager';
import { World } from './world';
import { ArenaConsts, KnightConsts, SummonerConsts } from './constants';
import type { PlayerClass, Vec2, WorldCallbacks } from './types';

export class GameRenderer {
    private app: Application | null = null;
    private host: HTMLElement | null = null;
    private worldRoot: Container | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private world: World | null = null;
    private inputManager: InputManager | null = null;

    /** The class selected for the current (or most recent) run. */
    private currentClass: PlayerClass = 'knight';

    /**
     * Shared callback bag. Passed by reference to each World, so callbacks
     * set after init() are automatically visible to the running World.
     */
    private readonly _callbacks: WorldCallbacks = {};

    /** True if the current device is touch-primary (available after init). */
    isTouchDevice = false;

    // ── Callback setters ─────────────────────────────────────────────────────

    set onHpChange(fn: ((hp: number, maxHp: number) => void) | undefined) {
        this._callbacks.onHpChange = fn;
    }

    set onRunEnd(fn: (() => void) | undefined) {
        this._callbacks.onRunEnd = fn;
    }

    set onLevelUp(fn: ((level: number, choices: import('./types').UpgradeChoice[]) => void) | undefined) {
        this._callbacks.onLevelUp = fn;
    }

    set onXpChange(fn: ((xp: number, xpToNext: number, level: number) => void) | undefined) {
        this._callbacks.onXpChange = fn;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    async init(host: HTMLElement, playerClass: PlayerClass = 'knight'): Promise<void> {
        if (this.app) return;
        this.host = host;
        this.currentClass = playerClass;

        const app = new Application();
        await app.init({
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            resizeTo: host,
            background: ArenaConsts.BACKGROUND_COLOR,
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

        this.world = new World(app, worldRoot, host, inputManager, this._callbacks, playerClass);

        this.resizeObserver = new ResizeObserver(() => app.resize());
        this.resizeObserver.observe(host);
    }

    /**
     * Starting HP for the current class — used by GameCanvasComponent to
     * initialise the HP signal before the first World tick fires.
     */
    getStartHp(): number {
        return this.currentClass === 'summoner' ? SummonerConsts.hp : KnightConsts.hp;
    }

    /**
     * Tear down the current World, clear the stage, and start a fresh run
     * with the same player class as before.
     * Callbacks already set on this renderer are automatically re-used.
     */
    restart(): void {
        if (!this.app || !this.host || !this.inputManager) return;

        this.world?.destroy();
        this.world = null;

        // Remove and recreate worldRoot so we start with a clean container tree
        if (this.worldRoot) {
            this.app.stage.removeChild(this.worldRoot);
            this.worldRoot.destroy({ children: true });
        }

        const worldRoot = new Container();
        worldRoot.label = 'world';
        this.app.stage.addChild(worldRoot);
        this.worldRoot = worldRoot;

        this.world = new World(
            this.app, worldRoot, this.host, this.inputManager,
            this._callbacks, this.currentClass,
        );
    }

    /** Returns the number of seconds elapsed in the current run. */
    getRunTime(): number {
        return this.world?.runTime ?? 0;
    }

    /**
     * Relay the upgrade selection from Angular to the active World.
     * Unpauses the sim once the upgrade is applied.
     */
    selectUpgrade(id: string): void {
        this.world?.selectUpgrade(id);
    }

    /** Called by the left joystick overlay (touch devices). */
    setTouchMove(v: Vec2 | null): void {
        this.inputManager?.setTouchMove(v);
    }

    /** Called by the right joystick overlay (touch devices). */
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

    // Debug methods
    public grantXpDebug() {
        this.world?.getLevelSystem()?.addXp(200);
    }
}
