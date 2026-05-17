import { Component, OnDestroy, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SocketService } from '../../mirror-sketch/services/socket.service';
import { StateService } from './services/state.service';
import { LobbyComponent } from './components/lobby/lobby.component';
import { BuildingComponent } from './components/building/building.component';
import { TriviaComponent } from './components/trivia/trivia.component';
import { BattleComponent } from './components/battle/battle.component';
import type { SlingWarPhase } from '../game.types';
import type { RoomState } from '../../mirror-sketch/models/game.types';

@Component({
    selector: 'sg-sling-war',
    imports: [RouterModule, LobbyComponent, BuildingComponent, TriviaComponent, BattleComponent],
    templateUrl: "sling-war.component.html",
    styleUrls: ["sling-war.component.scss"],
    standalone: true,
})
export class SlingWarComponent implements OnDestroy {
    phase = signal<SlingWarPhase | null>(null);
    roomCode = signal<string | null>(null);

    private destroy$ = false;

    constructor(
        private socket: SocketService,
        private state: StateService,
    ) {
        this.socket.roomState$.subscribe((roomState: RoomState) => {
            if (this.destroy$) return;
            const game = roomState.game as Record<string, unknown> | null;
            if (!game) return;
            this.roomCode.set(roomState.code);
            this.state.syncFromRoom(roomState);
            const phase = game['phase'] as SlingWarPhase | undefined;
            if (phase) this.phase.set(phase);
        });
    }

    ngOnDestroy(): void {
        this.destroy$ = true;
    }
}
