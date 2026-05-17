import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SocketService } from "../../../../mirror-sketch/services/socket.service";
import { RoomState } from "../../../../mirror-sketch/models/game.types";

@Component({
    selector: 'sg-lobby',
    imports: [FormsModule],
    template: `
        <div class="sg-lobby">
            <h1 class="sg-title">Sling War</h1>
            <p class="sg-subtitle">Build. Trivia. Destroy.</p>

            @if (!roomCode()) {
                <div class="sg-actions">
                    <button class="sg-btn sg-btn-primary" (click)="createRoom()">Create Room</button>
                    <div class="sg-divider">— or —</div>
                    <div class="sg-join">
                        <input
                                type="text"
                                class="sg-input"
                                placeholder="Enter room code"
                                [(ngModel)]="joinCode"
                                maxlength="4"
                                (keyup.enter)="joinRoom()"
                        />
                        <button class="sg-btn" (click)="joinRoom()" [disabled]="joinCode.length !== 4">Join</button>
                    </div>
                </div>
            }

            @if (roomCode()) {
                <div class="sg-room">
                    <div class="sg-code-box">Room: <span class="sg-code-value">{{ roomCode() }}</span></div>
                    <p class="sg-invite">Share this code with your opponent</p>

                    @if (!mySlot()) {
                        <div class="sg-pick-slot">
                            <p>Choose your slot:</p>
                            <button class="sg-btn" (click)="pickSlot('p1')">Player 1 (Left)</button>
                            <button class="sg-btn" (click)="pickSlot('p2')">Player 2 (Right)</button>
                        </div>
                    }

                    @if (mySlot()) {
                        @if (!isReady()) {
                            <button class="sg-btn sg-btn-ready" (click)="readyUp()">Ready Up!</button>
                        } @else {
                            <p class="sg-ready-text">You're ready! Waiting for opponent...</p>
                        }
                    }
                </div>
            }
        </div>
    `,
    styles: [`
      .sg-lobby {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
      }

      .sg-title {
        font-size: 2.5rem;
        margin: 0;
        color: var(--sg-accent, #e94560);
      }

      .sg-subtitle {
        font-size: 1.125rem;
        color: var(--sg-muted, #888);
        margin: 0.5rem 0 2rem;
      }

      .sg-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .sg-divider {
        color: var(--sg-muted, #555);
        font-size: 0.875rem;
      }

      .sg-join {
        display: flex;
        gap: 0.5rem;
      }

      .sg-input {
        width: 120px;
        padding: 0.5rem;
        border: 1px solid var(--sg-border, #0f3460);
        border-radius: 4px;
        background: var(--sg-input-bg, #16213e);
        color: var(--sg-text, #e0e0e0);
        font-size: 1rem;
        text-align: center;
        text-transform: uppercase;
      }

      .sg-btn {
        padding: 0.75rem 2rem;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.15s;
        background: var(--sg-card-bg, #16213e);
        color: var(--sg-text, #e0e0e0);
        border: 1px solid var(--sg-border, #0f3460);
      }

      .sg-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .sg-btn-primary {
        background: var(--sg-accent, #e94560);
        color: white;
      }

      .sg-btn-primary:hover:not(:disabled) {
        background: var(--sg-accent-hover, #c73e56);
      }

      .sg-btn-ready {
        background: var(--sg-green, #2ecc71);
        color: white;
        font-size: 1.25rem;
        padding: 1rem 3rem;
      }

      .sg-btn-ready:hover:not(:disabled) {
        background: var(--sg-green-hover, #27ae60);
      }

      .sg-room {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .sg-code-box {
        background: var(--sg-muted, #333);
        padding: 1rem 2rem;
        border-radius: 8px;
        font-size: 1.5rem;
        font-weight: 700;
      }

      .sg-code-value {
        color: var(--sg-accent, #e94560);
        font-family: monospace;
      }

      .sg-invite {
        color: var(--sg-muted, #888);
        font-size: 0.875rem;
      }

      .sg-pick-slot {
        display: flex;
        gap: 1rem;
      }

      .sg-ready-text {
        color: var(--sg-muted, #aaa);
        font-style: italic;
      }
    `],
})
export class LobbyComponent implements OnDestroy {
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
            const game = roomState.__game;
            if (!game) return;
            this.roomCode.set(roomState.code);
            this.p1Ready.set(!!game['p1Ready']);
            this.p2Ready.set(!!game['p2Ready']);
        });
    }

    ngOnDestroy(): void {
        // cleanup
    }

    async createRoom(): Promise<void> {
        const res = await this.socket.createRoomWithGame();
        if (res.ok && res.state) {
            this.roomCode.set(res.state.code);
            const game = res.state.__game as Record<string, unknown> | null;
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
            const game = res.state.__game as Record<string, unknown> | null;
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
