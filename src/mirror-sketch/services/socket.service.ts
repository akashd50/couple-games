import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AckResponse, DrawStroke, GameStartedPayload, Role, RoomState } from '../models/game.types';

// In dev the Angular server runs on a different port from the socket server.
// Use absolute URL when present, otherwise same origin.
const SOCKET_URL =
  (typeof window !== 'undefined' && (window as unknown as { __SOCKET_URL__?: string }).__SOCKET_URL__) ||
  'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;

  private readonly roomStateSubject = new Subject<RoomState>();
  private readonly drawStrokeSubject = new Subject<DrawStroke>();
  private readonly drawReplaySubject = new Subject<DrawStroke[]>();
  private readonly drawClearSubject = new Subject<void>();
  private readonly gameStartedSubject = new Subject<GameStartedPayload>();
  private readonly gameRevealSubject = new Subject<void>();
  private readonly gameResetSubject = new Subject<void>();
  private readonly peerLeftSubject = new Subject<{ id: string }>();
  private readonly connectedSubject = new Subject<boolean>();

  readonly roomState$: Observable<RoomState> = this.roomStateSubject.asObservable();
  readonly drawStroke$: Observable<DrawStroke> = this.drawStrokeSubject.asObservable();
  readonly drawReplay$: Observable<DrawStroke[]> = this.drawReplaySubject.asObservable();
  readonly drawClear$: Observable<void> = this.drawClearSubject.asObservable();
  readonly gameStarted$: Observable<GameStartedPayload> = this.gameStartedSubject.asObservable();
  readonly gameReveal$: Observable<void> = this.gameRevealSubject.asObservable();
  readonly gameReset$: Observable<void> = this.gameResetSubject.asObservable();
  readonly peerLeft$: Observable<{ id: string }> = this.peerLeftSubject.asObservable();
  readonly connected$: Observable<boolean> = this.connectedSubject.asObservable();

  private mySocketId: string | null = null;

  connect(): void {
    if (this.socket && this.socket.connected) return;
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      // Bypass ngrok's free-tier interstitial on the polling-transport handshake.
      // Browsers ignore extraHeaders on the WebSocket upgrade, but it covers fallbacks.
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });

    this.socket.on('connect', () => {
      this.mySocketId = this.socket?.id ?? null;
      this.connectedSubject.next(true);
    });
    this.socket.on('disconnect', () => this.connectedSubject.next(false));

    this.socket.on('room:state', (state: RoomState) => this.roomStateSubject.next(state));
    this.socket.on('draw:stroke', (s: DrawStroke) => this.drawStrokeSubject.next(s));
    this.socket.on('draw:replay', (strokes: DrawStroke[]) => this.drawReplaySubject.next(strokes));
    this.socket.on('draw:clear', () => this.drawClearSubject.next());
    this.socket.on('game:started', (p: GameStartedPayload) => this.gameStartedSubject.next(p));
    this.socket.on('game:reveal', () => this.gameRevealSubject.next());
    this.socket.on('game:reset', () => this.gameResetSubject.next());
    this.socket.on('peer:left', (p: { id: string }) => this.peerLeftSubject.next(p));
  }

  get id(): string | null {
    return this.mySocketId;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  createRoom(): Promise<AckResponse> {
    return this.emitWithAck('room:create', {});
  }

  joinRoom(code: string): Promise<AckResponse> {
    return this.emitWithAck('room:join', { code });
  }

  chooseRole(role: Role): Promise<AckResponse> {
    return this.emitWithAck('role:choose', { role });
  }

  setSpectator(spectator: boolean): Promise<AckResponse> {
    return this.emitWithAck('room:settings', { spectator });
  }

  startGame(sceneId: string): Promise<AckResponse> {
    return this.emitWithAck('game:start', { sceneId });
  }

  sendStroke(stroke: DrawStroke): void {
    this.socket?.emit('draw:stroke', stroke);
  }

  sendClear(): void {
    this.socket?.emit('draw:clear');
  }

  reveal(): void {
    this.socket?.emit('game:reveal');
  }

  resetGame(): void {
    this.socket?.emit('game:reset');
  }

  private emitWithAck(event: string, payload: unknown): Promise<AckResponse> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve({ ok: false, error: 'Socket not connected' });
        return;
      }
      this.socket.emit(event, payload, (res: AckResponse) => resolve(res));
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
