import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, ReplaySubject, shareReplay, Subject } from 'rxjs';
import { SocketService } from '../../../mirror-sketch/services/socket.service';
import type { RoomState } from '../../../mirror-sketch/models/game.types';
import { SlingWarGame, SlingWarPhase, SlingWarRoomState } from '../../game.types';

@Injectable({providedIn: 'root'})
export class StateService {
    private readonly roomStateSubject = new BehaviorSubject<SlingWarRoomState | undefined>(undefined);
    readonly roomState$ = this.roomStateSubject.asObservable().pipe(shareReplay({bufferSize: 1, refCount: true}));
    private _mySlot: 'p1' | 'p2' | null = null;

    get phase$(): Observable<SlingWarPhase> {
        return this.roomState$.pipe(map(s => s.game.phase));
    }

    get game$(): Observable<SlingWarGame> {
        return this.roomState$.pipe(map(s => s.game));
    }

    get game(): SlingWarGame {
        return this.roomStateSubject.value?.game;
    }

    get mySlot(): 'p1' | 'p2' | null {
        return this._mySlot;
    }

    setMySlot(slot: 'p1' | 'p2'): void {
        this._mySlot = slot;
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
        this.socket.connect();
        this.socket.roomState$.subscribe((roomState: SlingWarRoomState) => {
            const game = roomState.game;
            if (!game) {
                return;
            }

            this.roomStateSubject.next(roomState);
        });
    }
}
