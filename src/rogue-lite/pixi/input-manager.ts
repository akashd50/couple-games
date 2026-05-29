import { Vec2, InputState } from './types';

/**
 * Manages all input channels (keyboard + mouse for desktop, touch vectors from
 * the Angular joystick overlays for mobile) and merges them into a single
 * InputState consumed by the game world.
 *
 * This class is Angular-free; it works purely with DOM APIs so it can be
 * reused server-side in Phase 7.
 */
export class InputManager {
    private readonly keysDown = new Set<string>();
    private mouseScreenX = 0;
    private mouseScreenY = 0;
    private touchMove: Vec2 | null = null;
    private touchAim: Vec2 | null = null;
    private host: HTMLElement | null = null;

    private readonly onKeyDown = (e: KeyboardEvent): void => {
        this.keysDown.add(e.key.toLowerCase());
    };

    private readonly onKeyUp = (e: KeyboardEvent): void => {
        this.keysDown.delete(e.key.toLowerCase());
    };

    private readonly onMouseMove = (e: MouseEvent): void => {
        if (!this.host) return;
        const rect = this.host.getBoundingClientRect();
        this.mouseScreenX = e.clientX - rect.left;
        this.mouseScreenY = e.clientY - rect.top;
    };

    attach(host: HTMLElement): void {
        this.host = host;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        host.addEventListener('mousemove', this.onMouseMove);
    }

    detach(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        this.host?.removeEventListener('mousemove', this.onMouseMove);
        this.keysDown.clear();
        this.host = null;
    }

    /** Called by the left joystick overlay; pass null on release. */
    setTouchMove(v: Vec2 | null): void {
        this.touchMove = v;
    }

    /** Called by the right joystick overlay; pass null on release. */
    setTouchAim(v: Vec2 | null): void {
        // Only accept a non-zero aim vector so releasing snaps back to null
        // and the last mouse aim takes over on hybrid devices.
        this.touchAim = v && (v.x !== 0 || v.y !== 0) ? v : null;
    }

    /**
     * Returns the merged input state for the current frame.
     *
     * @param playerScreenX  The player's current X position in screen (CSS pixel)
     *                       space.  When provided, the mouse-aim vector is computed
     *                       relative to the player rather than the screen centre.
     *                       Pass this whenever the camera is clamped at the arena
     *                       edges so the aim origin tracks the player correctly.
     * @param playerScreenY  Matching Y component.
     */
    read(playerScreenX?: number, playerScreenY?: number): InputState {
        // --- Move ---
        let move: Vec2;
        if (this.touchMove) {
            move = this.touchMove.clone();
        } else {
            let mx = 0, my = 0;
            for (const k of this.keysDown) {
                if (k === 'w' || k === 'arrowup') my -= 1;
                if (k === 's' || k === 'arrowdown') my += 1;
                if (k === 'a' || k === 'arrowleft') mx -= 1;
                if (k === 'd' || k === 'arrowright') mx += 1;
            }
            const len = Math.hypot(mx, my);
            move = len > 1 ? new Vec2(mx / len, my / len) : new Vec2(mx, my);
        }

        // --- Aim ---
        // Use the player's actual screen position as the aim origin so that
        // mouse aim stays correct when the camera is clamped at the arena
        // edges (i.e. the player is no longer centred on screen).
        let aim: Vec2;
        if (this.touchAim) {
            aim = this.touchAim.clone();
        } else if (this.host) {
            const originX = playerScreenX ?? this.host.clientWidth / 2;
            const originY = playerScreenY ?? this.host.clientHeight / 2;
            const dx = this.mouseScreenX - originX;
            const dy = this.mouseScreenY - originY;
            const len = Math.hypot(dx, dy);
            aim = len > 1 ? new Vec2(dx / len, dy / len) : new Vec2(1, 0);
        } else {
            aim = new Vec2(1, 0);
        }

        return { move, aim };
    }

    /** Returns true if the primary input device is touch (evaluated once). */
    static isTouchDevice(): boolean {
        return typeof window !== 'undefined' &&
            ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
}
