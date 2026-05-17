import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SocketService } from "../../../../mirror-sketch/services/socket.service";
import { RoomState } from "../../../../mirror-sketch/models/game.types";

@Component({
    selector: 'sg-lobby',
    imports: [FormsModule],
    templateUrl: "lobby.component.html",
    styleUrls: ["./lobby.component.scss"],
    standalone: true,
})
export class LobbyComponent implements OnDestroy, OnInit {
    joinCode = '';
    roomCode = signal<string | null>(null);
    mySlot = signal<'p1' | 'p2' | null>(null);
    isReady = signal(false);
    p1Ready = signal(false);
    p2Ready = signal(false);

    constructor(
        private socket: SocketService,
    ) {
        this.socket.roomState$.subscribe((roomState: RoomState) => {
            const game = roomState.game;
            if (!game) return;
            this.roomCode.set(roomState.code);
            this.p1Ready.set(!!game['p1Ready']);
            this.p2Ready.set(!!game['p2Ready']);
        });
    }

    ngOnInit(): void {
        this.socket.connect();
    }

    ngOnDestroy(): void {
        // cleanup
    }

    async createRoom(): Promise<void> {
        const res = await this.socket.createRoomWithGame();
        if (res.ok && res.state) {
            this.roomCode.set(res.state.code);
            const game = res.state.game as Record<string, unknown> | null;
            if (game) {
                this.p1Ready.set(!!game['p1Ready']);
                this.p2Ready.set(!!game['p2Ready']);
            }
        }
    }

    async joinRoom(): Promise<void> {
        if (this.joinCode.length !== 4) return;
        const res = await this.socket.joinRoomWithGame(this.joinCode);
        if (res.ok && res.state) {
            this.roomCode.set(res.state.code);
            const game = res.state.game as Record<string, unknown> | null;
            if (game) {
                this.p1Ready.set(!!game['p1Ready']);
                this.p2Ready.set(!!game['p2Ready']);
            }
        }
    }

    pickSlot(slot: 'p1' | 'p2'): void {
        this.mySlot.set(slot);
        const role = slot === 'p1' ? 'player1' : 'player2';
        this.socket.chooseRole(role);
    }

    readyUp(): void {
        this.isReady.set(true);
        if (this.mySlot()) {
            this.socket.sendGameReady(this.mySlot()!);
        }
    }
}
