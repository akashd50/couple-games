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
    template: `
        <div class="sg-shell">
            <div class="sg-topbar">
                <a routerLink="/home" class="sg-back-btn">&larr; Back</a>
                <span class="sg-game-title">Sling War</span>
                @if (phase()) {
                    <span class="sg-phase">{{ phase() }}</span>
                }
                @if (roomCode()) {
                    <span class="sg-room-code">{{ roomCode() }}</span>
                }
            </div>
            <div class="sg-content">
                @switch (phase()) {
                    @case ('waiting') {
                        <sg-lobby/>
                    }
                    @case ('building') {
                        <sg-building/>
                    }
                    @case ('trivia') {
                        <sg-trivia/>
                    }
                    @case ('battle') {
                        <sg-battle/>
                    }
                    @case ('finished') {
                        <sg-battle/>
                    }
                    @default {
                        <sg-lobby/>
                    }
                }
            </div>
        </div>
    `,
    styles: [`
        .sg-shell {
            display: flex;
            flex-direction: column;
            height: 100vh;
            background: var(--sg-bg, #1a1a2e);
            color: var(--sg-text, #e0e0e0);
        }

        .sg-topbar {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.5rem 1rem;
            background: var(--sg-topbar-bg, #16213e);
            border-bottom: 1px solid var(--sg-border, #0f3460);
            font-size: 0.875rem;
        }

        .sg-back-btn {
            color: var(--sg-accent, #e94560);
            text-decoration: none;
        }

        .sg-game-title {
            font-weight: 700;
            font-size: 1.125rem;
        }

        .sg-phase {
            color: var(--sg-muted, #888);
        }

        .sg-room-code {
            margin-left: auto;
            font-family: monospace;
            background: var(--sg-muted, #333);
            padding: 0.125rem 0.5rem;
            border-radius: 4px;
        }

        .sg-content {
            flex: 1;
            overflow: hidden;
        }
    `],
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
