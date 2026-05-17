import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SlingWarStateService } from './services/sling-war-state.service';
import { LobbyComponent } from './components/lobby/lobby.component';
import { BuildingComponent } from './components/building/building.component';
import { TriviaComponent } from './components/trivia/trivia.component';
import { BattleComponent } from './components/battle/battle.component';
import type { SlingWarPhase, SlingWarRoomState } from '../game.types';
import { Subscription } from "rxjs";

@Component({
    selector: 'sg-sling-war',
    imports: [RouterModule, LobbyComponent, BuildingComponent, TriviaComponent, BattleComponent],
    templateUrl: "sling-war.component.html",
    styleUrls: ["sling-war.component.scss"],
    standalone: true,
})
export class SlingWarComponent implements OnDestroy, OnInit {
    phase = signal<SlingWarPhase | null>(null);
    roomCode = signal<string | null>(null);

    private subscription: Subscription;

    constructor(private state: SlingWarStateService) {
    }

    ngOnInit(): void {
        this.subscription = this.state.roomState$.subscribe((roomState: SlingWarRoomState) => {
            const game = roomState.game;
            if (!game) return;
            this.roomCode.set(roomState.code);
            this.phase.set(game.phase);
        });
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }
}
