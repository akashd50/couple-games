import type { Container } from 'pixi.js';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

// Camera applies a pan/zoom transform to the world root container.
// "scale" is a user-relative zoom multiplier; the actual container scale is
// fitScale * userScale, where fitScale is recomputed on viewport resize so
// userScale=1 always means "world fits the canvas".

const MIN_USER_SCALE = 0.5;
const MAX_USER_SCALE = 32;

export interface CameraInput {
  /** The Pixi container the camera transforms. */
  readonly target: Container;
  /** The DOM element receiving wheel/pointer events. */
  readonly host: HTMLElement;
  /** Returns current canvas size in CSS pixels. */
  readonly getViewport: () => { width: number; height: number };
}

export class Camera {
  private userScale = 1;
  private offsetX = 0;
  private offsetY = 0;

  // Pointer state for drag pan.
  private pointers = new Map<number, { x: number; y: number }>();
  private dragLast: { x: number; y: number } | null = null;
  // Pinch state.
  private pinchPrev: { dist: number; midX: number; midY: number } | null = null;

  private readonly onWheel: (e: WheelEvent) => void;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;

  constructor(private readonly input: CameraInput) {
    this.onWheel = (e) => this.handleWheel(e);
    this.onPointerDown = (e) => this.handlePointerDown(e);
    this.onPointerMove = (e) => this.handlePointerMove(e);
    this.onPointerUp = (e) => this.handlePointerUp(e);
  }

  attach(): void {
    const { host } = this.input;
    host.addEventListener('wheel', this.onWheel, { passive: false });
    host.addEventListener('pointerdown', this.onPointerDown);
    host.addEventListener('pointermove', this.onPointerMove);
    host.addEventListener('pointerup', this.onPointerUp);
    host.addEventListener('pointercancel', this.onPointerUp);
    host.addEventListener('pointerleave', this.onPointerUp);
    this.apply();
  }

  detach(): void {
    const { host } = this.input;
    host.removeEventListener('wheel', this.onWheel);
    host.removeEventListener('pointerdown', this.onPointerDown);
    host.removeEventListener('pointermove', this.onPointerMove);
    host.removeEventListener('pointerup', this.onPointerUp);
    host.removeEventListener('pointercancel', this.onPointerUp);
    host.removeEventListener('pointerleave', this.onPointerUp);
  }

  /** Recompute layout (called on canvas resize). */
  apply(): void {
    const { target } = this.input;
    const { width, height } = this.input.getViewport();
    const fit = Math.min(width / WORLD_WIDTH, height / WORLD_HEIGHT) || 1;
    const s = fit * this.userScale;
    target.scale.set(s);
    // Center the world horizontally/vertically before applying user offset.
    const centerX = (width - WORLD_WIDTH * s) / 2;
    const centerY = (height - WORLD_HEIGHT * s) / 2;
    target.position.set(centerX + this.offsetX, centerY + this.offsetY);
  }

  /** Convert canvas-local pixel coords to world coords. */
  screenToWorld(px: number, py: number): { x: number; y: number } {
    const t = this.input.target;
    return {
      x: (px - t.position.x) / t.scale.x,
      y: (py - t.position.y) / t.scale.y,
    };
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.input.host.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Smooth zoom: 1 wheel notch ≈ ±10%.
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.zoomAt(px, py, factor);
  }

  private handlePointerDown(e: PointerEvent): void {
    this.input.host.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.dragLast = { x: e.clientX, y: e.clientY };
    } else if (this.pointers.size === 2) {
      this.dragLast = null;
      this.pinchPrev = this.computePinch();
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1 && this.dragLast) {
      const dx = e.clientX - this.dragLast.x;
      const dy = e.clientY - this.dragLast.y;
      this.offsetX += dx;
      this.offsetY += dy;
      this.dragLast = { x: e.clientX, y: e.clientY };
      this.apply();
    } else if (this.pointers.size === 2 && this.pinchPrev) {
      const next = this.computePinch();
      if (!next) return;
      const factor = next.dist / this.pinchPrev.dist;
      const rect = this.input.host.getBoundingClientRect();
      this.zoomAt(next.midX - rect.left, next.midY - rect.top, factor);
      this.pinchPrev = next;
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchPrev = null;
    if (this.pointers.size === 0) this.dragLast = null;
    else if (this.pointers.size === 1) {
      const [only] = this.pointers.values();
      this.dragLast = { x: only.x, y: only.y };
    }
  }

  private computePinch(): { dist: number; midX: number; midY: number } | null {
    if (this.pointers.size !== 2) return null;
    const [a, b] = Array.from(this.pointers.values());
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
      dist: Math.hypot(dx, dy) || 1,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  }

  /** Zoom around a canvas-local pivot. Keeps the pivot point stable. */
  private zoomAt(px: number, py: number, factor: number): void {
    const prev = this.userScale;
    const next = Math.min(MAX_USER_SCALE, Math.max(MIN_USER_SCALE, prev * factor));
    if (next === prev) return;
    // World point under the cursor stays put: adjust offset so the cursor
    // still resolves to the same world coords after scaling.
    const t = this.input.target;
    const worldX = (px - t.position.x) / t.scale.x;
    const worldY = (py - t.position.y) / t.scale.y;
    this.userScale = next;
    this.apply();
    // After apply(), recompute where worldX/worldY landed and shift offset.
    const after = this.input.target;
    const sx = after.position.x + worldX * after.scale.x;
    const sy = after.position.y + worldY * after.scale.y;
    this.offsetX += px - sx;
    this.offsetY += py - sy;
    this.apply();
  }
}
