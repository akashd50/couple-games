import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LobbyComponent } from '../../shared/components/lobby/lobby.component';
import { RoomStateService } from '../../shared/services/room-state.service';
import { PhaseType, RoomState } from '../../common-types';
import { GameCanvasComponent } from '../components/game-canvas/game-canvas.component';

@Component({
    selector: 'rl-shell',
    standalone: true,
    imports: [CommonModule, RouterLink, LobbyComponent, GameCanvasComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './shell.component.html',
    styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit, OnDestroy {
    readonly phase = signal<PhaseType | null>(null);
    readonly roomCode = signal<string | null>(null);
    readonly debugInRun = signal(false);

    private subscription?: Subscription;

    constructor(readonly state: RoomStateService) {}

    ngOnInit(): void {
        this.subscription = this.state.roomState$.subscribe((roomState: RoomState) => {
            const game = roomState?.game;
            if (!game) return;
            this.roomCode.set(roomState.code);
            this.phase.set(game.phase);
        });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }

    enterRun(): void {
        this.debugInRun.set(true);
    }

    exitRun(): void {
        this.debugInRun.set(false);
    }
}
