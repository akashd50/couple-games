import type { Container } from 'pixi.js';
import { ArenaConsts, CameraConsts } from '../constants';
import type { Vec2 } from '../types';

/**
 * Follows the player with exponential-decay smoothing and a small lookahead
 * toward the aim direction. Moves `worldRoot` each frame so the camera center
 * maps to the canvas center.
 */
export class CameraSystem {
    private camX: number;
    private camY: number;

    constructor(
        private readonly worldRoot: Container,
        startX = ArenaConsts.SIZE / 2,
        startY = ArenaConsts.SIZE / 2,
    ) {
        this.camX = startX;
        this.camY = startY;
    }

    /**
     * Call every render frame (not fixed-step) for maximum smoothness.
     * @param dt        Raw frame delta in seconds.
     * @param playerPos Player world position.
     * @param aimVec    Normalized aim unit vector.
     * @param viewW     Canvas width in CSS pixels.
     * @param viewH     Canvas height in CSS pixels.
     */
    update(dt: number, playerPos: Vec2, aimVec: Vec2, viewW: number, viewH: number): void {
        // Lookahead: bias the camera slightly toward where the player is aiming
        const targetX = playerPos.x + aimVec.x * CameraConsts.LOOKAHEAD;
        const targetY = playerPos.y + aimVec.y * CameraConsts.LOOKAHEAD;

        // Framerate-independent exponential decay lerp
        const t = 1 - Math.exp(-CameraConsts.LERP * dt);
        this.camX += (targetX - this.camX) * t;
        this.camY += (targetY - this.camY) * t;

        // Clamp so the viewport never shows outside the arena
        const halfW = viewW / 2;
        const halfH = viewH / 2;
        const cx = viewW <= ArenaConsts.SIZE
            ? Math.max(halfW, Math.min(ArenaConsts.SIZE - halfW, this.camX))
            : ArenaConsts.SIZE / 2;
        const cy = viewH <= ArenaConsts.SIZE
            ? Math.max(halfH, Math.min(ArenaConsts.SIZE - halfH, this.camY))
            : ArenaConsts.SIZE / 2;

        // Shift worldRoot so cam center maps to screen center
        this.worldRoot.position.set(halfW - cx, halfH - cy);
    }

    /** Instantly snap the camera to a world position (call before first update). */
    teleportTo(x: number, y: number): void {
        this.camX = x;
        this.camY = y;
    }
}
