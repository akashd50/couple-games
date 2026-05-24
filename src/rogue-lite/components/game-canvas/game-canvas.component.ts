import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
    computed,
    inject,
    output,
    signal,
} from '@angular/core';
import { GameRenderer } from '../../pixi/game-renderer';
import { JoystickComponent } from '../joystick/joystick.component';
import { PLAYER_HP } from '../../pixi/constants';
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
    private timerInterval: ReturnType<typeof setInterval> | null = null;

    // ── Signals ──────────────────────────────────────────────────────────────

    readonly isTouchDevice = signal(false);
    readonly playerHp = signal(PLAYER_HP);
    readonly maxPlayerHp = PLAYER_HP;
    readonly runTime = signal(0);   // integer seconds, updated by interval
    readonly runEnded = signal(false);

    readonly hpPercent = computed(() =>
        Math.max(0, (this.playerHp() / this.maxPlayerHp) * 100),
    );

    readonly runTimeFormatted = computed(() => {
        const t = this.runTime();
        const m = Math.floor(t / 60);
        const s = t % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    });

    // ── Outputs ──────────────────────────────────────────────────────────────

    /** Emitted when the player clicks "Back to lobby" in the run-over modal. */
    readonly backToLobby = output<void>();

    // ── Lifecycle ────────────────────────────────────────────────────────────

    ngAfterViewInit(): void {
        void this.renderer.init(this.hostRef.nativeElement).then(() => {
            this.isTouchDevice.set(this.renderer.isTouchDevice);

            // HP changes fire from the Pixi ticker (outside Angular zone)
            // → must call markForCheck() so OnPush view updates.
            this.renderer.onHpChange = (hp) => {
                this.playerHp.set(hp);
                this.cdr.markForCheck();
            };

            this.renderer.onRunEnd = () => {
                this.runEnded.set(true);
                this.cdr.markForCheck();
            };

            // Poll run time once per second
            this.timerInterval = setInterval(() => {
                if (!this.runEnded()) {
                    this.runTime.set(Math.floor(this.renderer.getRunTime()));
                    this.cdr.markForCheck();
                }
            }, 1_000);

            this.cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        if (this.timerInterval !== null) clearInterval(this.timerInterval);
        this.renderer.destroy();
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    restart(): void {
        this.playerHp.set(PLAYER_HP);
        this.runTime.set(0);
        this.runEnded.set(false);
        this.renderer.restart();
        this.cdr.markForCheck();
    }

    onBackToLobby(): void {
        this.backToLobby.emit();
    }

    // ── Joystick bridge ──────────────────────────────────────────────────────

    onMoveVector(v: Vec2): void { this.renderer.setTouchMove(v); }
    onMoveRelease(): void       { this.renderer.setTouchMove(null); }
    onAimVector(v: Vec2): void  { this.renderer.setTouchAim(v); }
    onAimRelease(): void        { this.renderer.setTouchAim(null); }
}
