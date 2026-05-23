import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
    inject,
    signal,
} from '@angular/core';
import { GameRenderer } from '../../pixi/game-renderer';
import { JoystickComponent } from '../joystick/joystick.component';
import type { Vec2 } from '../../pixi/types';

@Component({
    selector: 'rl-game-canvas',
    standalone: true,
    imports: [JoystickComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './game-canvas.component.html',
    styleUrls: ['./game-canvas.component.scss'],
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
    @ViewChild('host', { static: true })
    private hostRef!: ElementRef<HTMLDivElement>;

    private readonly renderer = new GameRenderer();
    private readonly cdr = inject(ChangeDetectorRef);

    /** True once init resolves and the device is touch-primary. */
    readonly isTouchDevice = signal(false);

    ngAfterViewInit(): void {
        void this.renderer.init(this.hostRef.nativeElement).then(() => {
            this.isTouchDevice.set(this.renderer.isTouchDevice);
            this.cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this.renderer.destroy();
    }

    onMoveVector(v: Vec2): void {
        this.renderer.setTouchMove(v);
    }

    onMoveRelease(): void {
        this.renderer.setTouchMove(null);
    }

    onAimVector(v: Vec2): void {
        this.renderer.setTouchAim(v);
    }

    onAimRelease(): void {
        this.renderer.setTouchAim(null);
    }
}
