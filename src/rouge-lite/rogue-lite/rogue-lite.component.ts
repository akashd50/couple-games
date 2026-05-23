import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RoomStateService } from "../../shared/services/room-state.service";
import { RouterLink } from "@angular/router";
import { LobbyComponent } from "../../shared/components/lobby/lobby.component";
import { Subscription } from "rxjs";
import { PhaseType, RoomState } from "../../common-types";

@Component({
    selector: "rouge-lite",
    templateUrl: "./rouge-lite.component.html",
    styleUrls: ["./rouge-lite.component.scss"],
    standalone: true,
    imports: [
        CommonModule,
        LobbyComponent,
        RouterLink,
        LobbyComponent,
    ]
})
export class RogueLiteComponent implements OnInit, OnDestroy {
    phase = signal<PhaseType>(undefined);
    roomCode = signal<string>(undefined);
    private subscription: Subscription;

    constructor(
        readonly state: RoomStateService,
    ) {

    }

    ngOnInit() {
        this.subscription = this.state.roomState$.subscribe((roomState: RoomState) => {
            const game = roomState?.game;
            if (!game) return;
            this.roomCode.set(roomState.code);
            this.phase.set(game.phase);
        });
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }
}