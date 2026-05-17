import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, from, map, Observable, shareReplay, tap } from 'rxjs';
import { SocketService } from '../../../mirror-sketch/services/socket.service';
import { SlingWarGame, SlingWarGamePlayer, SlingWarPhase, SlingWarRoomState } from '../../game.types';
import { Role } from "../../../mirror-sketch/models/game.types";

@Injectable({providedIn: 'root'})
export class SlingWarStateService {
    private readonly roomStateSubject = new BehaviorSubject<SlingWarRoomState | undefined>(undefined);
    readonly roomState$ = this.roomStateSubject.asObservable().pipe(shareReplay({bufferSize: 1, refCount: true}));
    private _myId: string;
    private _player: SlingWarGamePlayer;

    get phase$(): Observable<SlingWarPhase> {
        return this.roomState$.pipe(map(s => s.game.phase));
    }

    get game$(): Observable<SlingWarGame> {
        return this.roomState$.pipe(map(s => s.game));
    }

    get game(): SlingWarGame {
        return this.roomStateSubject.value?.game;
    }

    get player(): SlingWarGamePlayer {
        return this._player;
    }

    readyForBuilding(): void {
        this.socket.sendGameReady();
    }

    sendLayout(layout: { p1: unknown[]; p2: unknown[] }): void {
        this.socket.sendGameLayout(layout);
    }

    sendTriviaAsked(): void {
        this.socket.sendTriviaAsked();
    }

    awardPoint(): void {
        this.socket.sendTriviaAwarded();
    }

    readyForBattle(): void {
        this.socket.sendBattleReady();
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

            this._player = roomState.players.find(p => p.id === this._myId);
            this.roomStateSubject.next(roomState);
        });
    }

    public createRoom(): Observable<SlingWarRoomState> {
        return from(this.socket.createRoomWithGame()).pipe(
            filter(f => f.ok && !!f.state),
            tap(f => this._myId = f.you),
            map(f => f.state as SlingWarRoomState)
        );
    }

    public joinRoom(code: string): Observable<SlingWarRoomState> {
        return from(this.socket.joinRoomWithGame(code)).pipe(
            filter(f => f.ok && !!f.state),
            tap(f => this._myId = f.you),
            map(f => f.state as SlingWarRoomState)
        );
    }

    public selectRole(role: Role): Observable<boolean> {
        return from(this.socket.chooseRole(role)).pipe(filter(f => f.ok), map(f => f.ok));
    }

    public readyUp(): void {
        this.socket.sendGameReady();
    }
}
