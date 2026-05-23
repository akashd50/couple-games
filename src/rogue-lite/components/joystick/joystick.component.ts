import {
    ChangeDetectionStrategy,
    Component,
    output,
    signal,
} from '@angular/core';
import type { Vec2 } from '../../pixi/types';

/** Max knob displacement from centre in CSS pixels. */
const STICK_RADIUS = 40;

/**
 * Virtual joystick overlay for touch input.
 *
 * Emits a normalized Vec2 on each pointer move and `released` when the finger
 * lifts. Uses `setPointerCapture` so the pointer is tracked even if it moves
 * outside the element bounds.
 *
 * Place with absolute positioning in the game-canvas component.
 */
@Component({
    selector: 'rl-joystick',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './joystick.component.html',
    styleUrls: ['./joystick.component.scss'],
})
export class JoystickComponent {
    /** Emits a normalized Vec2 {x, y} (-1..1) on every pointer move. */
    readonly vectorChange = output<Vec2>();
    /** Emits when the finger is lifted or the pointer is cancelled. */
    readonly released = output<void>();

    readonly knobTransform = signal('translate(0px, 0px)');

    private activePointerId: number | null = null;
    private originX = 0;
    private originY = 0;

    onDown(e: PointerEvent): void {
        if (this.activePointerId !== null) return; // single-touch per joystick
        e.preventDefault();
        this.activePointerId = e.pointerId;
        // Capture pointer so we receive moves outside the element
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        // Store ring centre as origin for displacement calculation
        const rect = target.getBoundingClientRect();
        this.originX = rect.left + rect.width / 2;
        this.originY = rect.top + rect.height / 2;
        this.process(e.clientX, e.clientY);
    }

    onMove(e: PointerEvent): void {
        if (e.pointerId !== this.activePointerId) return;
        this.process(e.clientX, e.clientY);
    }

    onUp(e: PointerEvent): void {
        if (e.pointerId !== this.activePointerId) return;
        this.activePointerId = null;
        this.knobTransform.set('translate(0px, 0px)');
        this.released.emit();
    }

    private process(clientX: number, clientY: number): void {
        let dx = clientX - this.originX;
        let dy = clientY - this.originY;
        const dist = Math.hypot(dx, dy);
        // Clamp knob to the ring radius
        if (dist > STICK_RADIUS) {
            dx = (dx / dist) * STICK_RADIUS;
            dy = (dy / dist) * STICK_RADIUS;
        }
        this.knobTransform.set(`translate(${dx}px, ${dy}px)`);
        // Normalize to -1..1 (zero when displacement is negligible)
        const nx = dist > 0.5 ? dx / STICK_RADIUS : 0;
        const ny = dist > 0.5 ? dy / STICK_RADIUS : 0;
        this.vectorChange.emit({ x: nx, y: ny });
    }
}
