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
import { KnightConsts } from '../../pixi/constants';
import { xpForLevel } from '../../pixi/systems/level-system';
import type { UpgradeChoice, Vec2 } from '../../pixi/types';
import { SettingMenuService } from "../../../shared/services/settings-menu.service";

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
    private menuService: SettingMenuService = inject(SettingMenuService);

    private readonly renderer = new GameRenderer();
    private readonly cdr = inject(ChangeDetectorRef);
    private timerInterval: ReturnType<typeof setInterval> | null = null;

    // ── Signals ──────────────────────────────────────────────────────────────

    readonly isTouchDevice = signal(false);
    readonly playerHp = signal(KnightConsts.hp);
    readonly maxPlayerHp = KnightConsts.hp;
    readonly runTime = signal(0);   // integer seconds, updated by interval
    readonly runEnded = signal(false);

    // Level / XP
    readonly level = signal(1);
    readonly xp = signal(0);
    readonly xpToNext = signal(xpForLevel(1));
    readonly levelUpChoices = signal<UpgradeChoice[]>([]);
    readonly showLevelUp = signal(false);

    readonly hpPercent = computed(() =>
        Math.max(0, (this.playerHp() / this.maxPlayerHp) * 100),
    );

    readonly xpPercent = computed(() =>
        Math.max(0, Math.min(100, (this.xp() / this.xpToNext()) * 100)),
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
                this.playerHp.set(Math.round(hp));
                this.cdr.markForCheck();
            };

            this.renderer.onRunEnd = () => {
                this.runEnded.set(true);
                this.showLevelUp.set(false); // dismiss any open level-up modal
                this.cdr.markForCheck();
            };

            this.renderer.onLevelUp = (level, choices) => {
                this.level.set(level);
                this.levelUpChoices.set(choices);
                this.showLevelUp.set(true);
                this.cdr.markForCheck();
            };

            this.renderer.onXpChange = (xp, xpToNext, level) => {
                this.xp.set(xp);
                this.xpToNext.set(xpToNext);
                this.level.set(level);
                this.cdr.markForCheck();
            };

            // Poll run time once per second
            this.timerInterval = setInterval(() => {
                if (!this.runEnded()) {
                    this.runTime.set(Math.floor(this.renderer.getRunTime()));
                    this.cdr.markForCheck();
                }
            }, 1_000);

            this.menuService.addMenuItem({
                id: "grant-xp",
                text: "Grant xp +200",
                click: () => this.renderer.grantXpDebug()
            });
            this.cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        if (this.timerInterval !== null) clearInterval(this.timerInterval);
        this.renderer.destroy();

        this.menuService.removeMenuItem("grant-xp");
    }

    // ── Actions ──────────────────────────────────────────────────────────────

    restart(): void {
        this.playerHp.set(KnightConsts.hp);
        this.runTime.set(0);
        this.runEnded.set(false);
        this.level.set(1);
        this.xp.set(0);
        this.xpToNext.set(xpForLevel(1));
        this.showLevelUp.set(false);
        this.levelUpChoices.set([]);
        this.renderer.restart();
        this.cdr.markForCheck();
    }

    /** Called when the player taps an upgrade card in the level-up modal. */
    selectUpgrade(id: string): void {
        this.showLevelUp.set(false);
        this.renderer.selectUpgrade(id);
        this.cdr.markForCheck();
    }

    onBackToLobby(): void {
        this.backToLobby.emit();
    }

    /** Generate a range array for stack-pip rendering in the template. */
    stackRange(n: number): number[] {
        return Array.from({ length: n }, (_, i) => i);
    }

    // ── Joystick bridge ──────────────────────────────────────────────────────

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
