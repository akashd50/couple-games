import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, from, map, Observable, of, shareReplay, tap } from 'rxjs';
import { SocketService } from '../../../mirror-sketch/services/socket.service';
import { SlingWarGame, SlingWarGamePlayer, SlingWarPhase, SlingWarRoomState } from '../../game.types';
import { Role } from "../../../mirror-sketch/models/game.types";

@Injectable({providedIn: 'root'})
export class TestSlingWarStateService {
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
    }

    sendLayout(layout: { p1: unknown[]; p2: unknown[] }): void {
    }

    sendTriviaAsked(): void {
    }

    awardPoint(): void {
    }

    readyForBattle(): void {
    }

    sendBattleSync(positions: { x: number; y: number; angle: number }[]): void {
    }

    buyPowerUp(powerUpId: string): void {
    }

    private testRoomState: SlingWarRoomState;

    constructor() {
        this._myId = "player1";
        this.testRoomState = {
            game: {
                phase: "building",
            } as SlingWarGame,
            players: [
                {
                    id: "player1",
                    role: "player1",
                    layout: [],
                    ready: true,
                } as SlingWarGamePlayer,
                {
                    id: "player2",
                    role: "player2",
                    layout: [],
                    ready: true,
                } as SlingWarGamePlayer
            ],
            code: "TEST",
            sceneId: '',
            spectator: false,
            gameType: "sling-war",
        };

        this._player = this.testRoomState.players.find(p => p.id === this._myId);
        this.roomStateSubject.next(this.testRoomState);
    }

    public createRoom(): Observable<SlingWarRoomState> {
        return of(this.testRoomState);
    }

    public joinRoom(code: string): Observable<SlingWarRoomState> {
        return of(this.testRoomState);
    }

    public selectRole(role: Role): Observable<boolean> {
        return of(true);
    }

    public readyUp(): void {

    }
}
