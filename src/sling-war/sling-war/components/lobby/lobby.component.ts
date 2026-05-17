import {
    Component,
    OnDestroy,
    OnInit,
    signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SlingWarStateService } from "../../services/sling-war-state.service";
import { SlingWarGamePlayer, SlingWarRoomState } from "../../../game.types";
import { take } from "rxjs";
import { NgClass } from "@angular/common";
import { Role } from "../../../../mirror-sketch/models/game.types";

@Component({
    selector: 'sg-lobby',
    imports: [FormsModule, NgClass],
    templateUrl: "lobby.component.html",
    styleUrls: ["./lobby.component.scss"],
    standalone: true,
})
export class LobbyComponent implements OnDestroy, OnInit {
    joinCode = '';
    roomCode = signal<string | null>(null);
    isReady = signal(false);
    player = signal<SlingWarGamePlayer>(undefined);
    p1Ready = signal(false);
    p2Ready = signal(false);

    constructor(private state: SlingWarStateService) {
    }

    ngOnInit(): void {
        this.state.roomState$.subscribe((roomState: SlingWarRoomState) => {
            const game = roomState.game;
            const player = this.state.player;
            if (!game) {
                return;
            }
            this.player.set(player);
            this.roomCode.set(roomState.code);

            this.isReady.set(player.ready);

            const player1 = roomState.players.find(p => p.role === "player1");
            const player2 = roomState.players.find(p => p.role === "player2");
            this.p1Ready.set(!!player1?.ready);
            this.p2Ready.set(!!player2?.ready);
        });
    }

    ngOnDestroy(): void {
        // cleanup
    }

    createRoom() {
        this.state.createRoom().pipe(take(1)).subscribe();
    }

    joinRoom() {
        if (this.joinCode.length !== 4) {
            return;
        }
        this.state.joinRoom(this.joinCode).pipe(take(1)).subscribe();
    }

    pickSlot(role: Role): void {
        this.state.selectRole(role).subscribe();
    }

    readyUp(): void {
        this.state.readyUp();
    }
}
