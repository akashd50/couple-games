import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { SocketService } from '../../../mirror-sketch/services/socket.service';
import type { RoomState } from '../../../mirror-sketch/models/game.types';
import type { SlingWarGame } from '../../game.types';

@Injectable({providedIn: 'root'})
export class StateService {
    private readonly phaseSubject = new Subject<SlingWarGame['phase']>();
    readonly phase$ = this.phaseSubject.asObservable();

    private _game: SlingWarGame | null = null;
    private _mySlot: 'p1' | 'p2' | null = null;

    get phase(): SlingWarGame['phase'] | null {
        return this._game?.phase ?? null;
    }

    get game(): SlingWarGame | null {
        return this._game;
    }

    get mySlot(): 'p1' | 'p2' | null {
        return this._mySlot;
    }

    setMySlot(slot: 'p1' | 'p2'): void {
        this._mySlot = slot;
    }

    syncFromRoom(roomState: RoomState): void {
        const game = roomState.game as unknown as SlingWarGame | null;
        if (!game) return;
        const old = this._game;
        this._game = game;
        if (!old) {
            this.phaseSubject.next(game.phase);
        } else if (old.phase !== game.phase) {
            this.phaseSubject.next(game.phase);
        }
    }

    readyForBuilding(): void {
        if (!this._mySlot) return;
        this.socket.sendGameReady(this._mySlot);
    }

    sendLayout(layout: { p1: unknown[]; p2: unknown[] }): void {
        this.socket.sendGameLayout(layout);
    }

    sendTriviaAsked(): void {
        if (!this._mySlot) return;
        this.socket.sendTriviaAsked(this._mySlot);
    }

    awardPoint(toSlot: 'p1' | 'p2'): void {
        this.socket.sendTriviaAwarded(toSlot);
    }

    readyForBattle(): void {
        if (!this._mySlot) return;
        this.socket.sendBattleReady(this._mySlot);
    }

    sendBattleSync(positions: { x: number; y: number; angle: number }[]): void {
        this.socket.sendBattleSync(positions);
    }

    buyPowerUp(powerUpId: string): void {
        this.socket.sendPowerUp(powerUpId);
    }

    constructor(private socket: SocketService) {
        // Already synced via LobbyComponent / SlingWarComponent subscriptions
    }
}
