import { Injectable, computed, signal } from '@angular/core';
import { Role, RoomState, Scene } from '../models/game.types';
import { SCENES, getSceneById } from '../data/scenes';

// Holds the local game state derived from server messages so components
// can react via Angular signals without each managing their own subscriptions.
@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly _roomCode = signal<string | null>(null);
  private readonly _myId = signal<string | null>(null);
  private readonly _state = signal<RoomState | null>(null);
  private readonly _phase = signal<GamePhase>('idle');
  private readonly _sceneId = signal<string | null>(null);

  readonly roomCode = this._roomCode.asReadonly();
  readonly myId = this._myId.asReadonly();
  readonly state = this._state.asReadonly();
  readonly phase = this._phase.asReadonly();

  readonly me = computed(() => this._state()?.players.find((p) => p.id === this._myId()) ?? null);
  readonly peer = computed(() => this._state()?.players.find((p) => p.id !== this._myId()) ?? null);
  readonly myRole = computed<Role | null>(() => this.me()?.role ?? null);
  readonly bothJoined = computed(() => (this._state()?.players.length ?? 0) >= 2);
  readonly bothChose = computed(() => {
    const players = this._state()?.players ?? [];
    if (players.length !== 2) return false;
    const roles = players.map((p) => p.role);
    return roles[0] !== null && roles[1] !== null && roles[0] !== roles[1];
  });
  readonly spectator = computed<boolean>(() => this._state()?.spectator ?? true);
  readonly currentScene = computed<Scene | null>(() => getSceneById(this._sceneId()));

  readonly scenes: readonly Scene[] = SCENES;

  setRoom(code: string, myId: string, state: RoomState): void {
    this._roomCode.set(code);
    this._myId.set(myId);
    this._state.set(state);
    this._phase.set('lobby');
  }

  updateState(state: RoomState): void {
    this._state.set(state);
    if (state.sceneId) this._sceneId.set(state.sceneId);
  }

  setPhase(phase: GamePhase): void {
    this._phase.set(phase);
  }

  setSceneId(id: string | null): void {
    this._sceneId.set(id);
  }

  reset(): void {
    this._roomCode.set(null);
    this._myId.set(null);
    this._state.set(null);
    this._phase.set('idle');
    this._sceneId.set(null);
  }
}

export type GamePhase = 'idle' | 'lobby' | 'playing' | 'reveal';
