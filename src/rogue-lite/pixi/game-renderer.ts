import { Application, Container, Text } from 'pixi.js';

const BACKGROUND_COLOR = 0x0e0e1a;

export class GameRenderer {
    private app: Application | null = null;
    private host: HTMLElement | null = null;
    private worldRoot: Container | null = null;
    private resizeObserver: ResizeObserver | null = null;

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

        this.worldRoot = new Container();
        this.worldRoot.label = 'world';
        app.stage.addChild(this.worldRoot);

        const hello = new Text({
            text: 'Hello, rogue-lite',
            style: {
                fill: 0xe0e0e0,
                fontFamily: 'sans-serif',
                fontSize: 24,
                fontWeight: '600',
            },
        });
        hello.label = 'hello';
        hello.anchor.set(0.5);
        this.worldRoot.addChild(hello);
        this.centerHello(hello);

        this.resizeObserver = new ResizeObserver(() => {
            this.app?.resize();
            this.centerHello(hello);
        });
        this.resizeObserver.observe(host);
    }

    destroy(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;

        if (this.app) {
            this.app.destroy(true, { children: true });
            this.app = null;
        }
        this.worldRoot = null;
        this.host = null;
    }

    private centerHello(hello: Text): void {
        if (!this.host) return;
        hello.position.set(this.host.clientWidth / 2, this.host.clientHeight / 2);
    }
}
