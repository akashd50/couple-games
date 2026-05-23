import {
    Component, Input, input,
    OnDestroy,
    OnInit,
    signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { take } from "rxjs";
import { NgClass } from "@angular/common";
import { Player, RoomState } from "../../../common-types";
import { RoomStateService } from "../../services/room-state.service";
import { Role } from "../../../mirror-sketch/models/game.types";

@Component({
    selector: "common-lobby",
    imports: [FormsModule, NgClass],
    templateUrl: "lobby.component.html",
    styleUrls: ["./lobby.component.scss"],
    standalone: true,
})
export class LobbyComponent implements OnDestroy, OnInit {
    players = [2];
    selectedMaxPlayers = 2;

    @Input() set maxPlayers(value: number) {
        this.players = Array.from({length: value}, (_, i) => i + 1);
    };

    playerStates: Record<string, boolean> = {};

    joinCode = '';
    roomCode = signal<string | null>(null);
    isReady = signal(false);
    player = signal<Player>(undefined);
    /*p1Ready = signal(false);
    p2Ready = signal(false);*/
    pReady = signal<Record<string, boolean>>(undefined);

    constructor(private state: RoomStateService) {
    }

    ngOnInit(): void {
        this.state.roomState$.subscribe((roomState: RoomState) => {
            if (!roomState?.game) {
                return;
            }

            const player = this.state.player;
            this.player.set(player);
            this.roomCode.set(roomState.code);

            this.isReady.set(player.ready);

            const maxPlayers = roomState.maxPlayers;
            this.maxPlayers = maxPlayers;

            for (let i = 0; i < maxPlayers; i++) {
                const player = roomState.players.find(p => p.role === `player${i}`);
                this.playerStates[`player${i}`] = !!player?.ready;
                this.pReady.set(this.playerStates);
            }

            /*const player1 = roomState.players.find(p => p.role === "player1");
            const player2 = roomState.players.find(p => p.role === "player2");
            this.p1Ready.set(!!player1?.ready);
            this.p2Ready.set(!!player2?.ready);*/
        });
    }

    ngOnDestroy(): void {
        // cleanup
    }

    setMaxPlayers(maxPlayers: number): void {
        this.selectedMaxPlayers = maxPlayers;
    }


    createRoom() {
        this.state.createRoom("rogue-lite", this.selectedMaxPlayers).pipe(take(1)).subscribe();
    }

    joinRoom() {
        if (this.joinCode.length !== 4) {
            return;
        }
        this.state.joinRoom("rogue-lite", this.joinCode).pipe(take(1)).subscribe();
    }

    pickSlot(role: string): void {
        this.state.selectRole(role as Role).subscribe();
    }

    readyUp(): void {
        this.state.readyUp();
    }
}
