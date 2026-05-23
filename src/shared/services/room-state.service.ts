import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, from, map, Observable, shareReplay, tap } from 'rxjs';
import { Player, RoomState } from "../../common-types";
import { SocketService } from "../../mirror-sketch/services/socket.service";
import { Role } from "../../mirror-sketch/models/game.types";

@Injectable({providedIn: 'root'})
export class RoomStateService {
    private readonly roomStateSubject = new BehaviorSubject<RoomState>(undefined);
    readonly roomState$ = this.roomStateSubject.asObservable().pipe(shareReplay({bufferSize: 1, refCount: true}));
    private _myId: string;
    private _player: Player;

    get player(): Player {
        return this._player;
    }

    constructor(private socket: SocketService) {
        this.socket.connect();
        this.socket.roomState$.subscribe((roomState: RoomState) => {
            if (!roomState.game) {
                return;
            }

            this._player = roomState.players.find(p => p.id === this._myId);
            this.roomStateSubject.next(roomState);
        });
    }

    public createRoom(): Observable<RoomState> {
        return from(this.socket.createRoomWithGame()).pipe(
            filter(f => f.ok && !!f.state),
            tap(f => this._myId = f.you),
            map(f => f.state as RoomState)
        );
    }

    public joinRoom(code: string): Observable<RoomState> {
        return from(this.socket.joinRoomWithGame(code)).pipe(
            filter(f => f.ok && !!f.state),
            tap(f => this._myId = f.you),
            map(f => f.state as RoomState)
        );
    }

    public selectRole(role: Role): Observable<boolean> {
        return from(this.socket.chooseRole(role)).pipe(filter(f => f.ok), map(f => f.ok));
    }

    public readyUp(): void {
        this.socket.sendGameReady();
    }
}
