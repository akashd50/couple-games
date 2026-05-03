import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DrawStroke, Role, Scene } from '../../models/game.types';
import { GameService } from '../../services/game.service';
import { SocketService } from '../../services/socket.service';
import { DrawCanvasDirective } from '../../directives/draw-canvas.directive';
import { getRandomScene } from '../../data/scenes';

@Component({
  selector: 'ms-room',
  standalone: true,
  imports: [DrawCanvasDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './room.component.html',
  styleUrl: './room.component.scss',
})
export class RoomComponent implements OnInit {
  private readonly socket = inject(SocketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly game = inject(GameService);

  @ViewChild(DrawCanvasDirective) canvasDir?: DrawCanvasDirective;
  @ViewChild('canvasEl') canvasEl?: ElementRef<HTMLCanvasElement>;

  readonly busy = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly revealed = signal(false);
  readonly color = signal('#1c1d28');
  readonly brushSize = signal(5);

  readonly palette: readonly string[] = ['#1c1d28', '#7a5cff', '#d6336c', '#ffb703', '#2ec27e', '#1e90ff'];

  // Coalesce intermediate move events to ~30Hz so a free-tier tunnel (ngrok)
  // doesn't get hammered by 60-120Hz pointer rates. start/end always flush.
  private static readonly EMIT_INTERVAL_MS = 33;
  private pendingMove: DrawStroke | null = null;
  private moveFlushTimer: number | null = null;
  private lastEmitAt = 0;

  constructor() {
    effect(() => {
      const phase = this.game.phase();
      if (phase !== 'reveal') this.revealed.set(false);
      else this.revealed.set(true);
    });

    this.destroyRef.onDestroy(() => {
      if (this.moveFlushTimer !== null) {
        clearTimeout(this.moveFlushTimer);
        this.moveFlushTimer = null;
      }
      this.pendingMove = null;
    });
  }

  ngOnInit(): void {
    this.socket.connect();

    // If we landed on the room URL directly without state (refresh), bounce to lobby.
    if (!this.game.roomCode()) {
      void this.router.navigate(['/mirror-sketch']);
      return;
    }

    this.socket.roomState$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      this.game.updateState(state);
    });

    this.socket.drawStroke$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((s) => {
      this.canvasDir?.applyStroke(s);
    });

    this.socket.drawClear$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.canvasDir?.clear();
    });

    this.socket.gameStarted$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ sceneId }) => {
      this.game.setSceneId(sceneId);
      this.game.setPhase('playing');
      this.canvasDir?.clear();
    });

    this.socket.gameReveal$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.game.setPhase('reveal');
    });

    this.socket.gameReset$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.game.setPhase('lobby');
      this.game.setSceneId(null);
      this.canvasDir?.clear();
    });
  }

  // ----- role + game flow -----

  async chooseRole(role: Role): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const res = await this.socket.chooseRole(role);
    this.busy.set(false);
    if (!res.ok) this.errorMsg.set(res.error ?? 'Could not pick role');
  }

  async startGame(): Promise<void> {
    if (this.busy() || !this.game.bothChose()) return;
    this.busy.set(true);
    this.errorMsg.set(null);
    const scene = getRandomScene();
    const res = await this.socket.startGame(scene.id);
    this.busy.set(false);
    if (!res.ok) this.errorMsg.set(res.error ?? 'Could not start');
  }

  onStroke(stroke: DrawStroke): void {
    if (stroke.phase !== 'move') {
      this.flushPendingMove();
      this.socket.sendStroke(stroke);
      this.lastEmitAt = performance.now();
      return;
    }

    this.pendingMove = stroke;
    const elapsed = performance.now() - this.lastEmitAt;
    if (elapsed >= RoomComponent.EMIT_INTERVAL_MS) {
      this.flushPendingMove();
    } else if (this.moveFlushTimer === null) {
      this.moveFlushTimer = window.setTimeout(
        () => this.flushPendingMove(),
        RoomComponent.EMIT_INTERVAL_MS - elapsed,
      );
    }
  }

  private flushPendingMove(): void {
    if (this.moveFlushTimer !== null) {
      clearTimeout(this.moveFlushTimer);
      this.moveFlushTimer = null;
    }
    const s = this.pendingMove;
    if (!s) return;
    this.pendingMove = null;
    this.lastEmitAt = performance.now();
    this.socket.sendStroke(s);
  }

  clear(): void {
    this.canvasDir?.clear();
    this.socket.sendClear();
  }

  reveal(): void {
    this.socket.reveal();
  }

  playAgain(): void {
    this.socket.resetGame();
  }

  leave(): void {
    this.socket.disconnect();
    this.game.reset();
    void this.router.navigate(['/mirror-sketch']);
  }

  setColor(c: string): void {
    this.color.set(c);
  }

  setBrush(value: number): void {
    this.brushSize.set(value);
  }

  // ----- view helpers -----

  sceneSvg(scene: Scene | null): SafeHtml | null {
    if (!scene) return null;
    return this.sanitizer.bypassSecurityTrustHtml(scene.svg);
  }

  copyCode(): void {
    const code = this.game.roomCode();
    if (!code) return;
    void navigator.clipboard?.writeText(code);
  }

  isRoleTaken(role: Role): boolean {
    const state = this.game.state();
    if (!state) return false;
    return state.players.some((p) => p.id !== this.game.myId() && p.role === role);
  }

  myRoleIs(role: Role): boolean {
    return this.game.myRole() === role;
  }
}
