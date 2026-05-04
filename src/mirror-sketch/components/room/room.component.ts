import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
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

type CanvasTab = 'reference' | 'drawing';

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
  readonly color = signal('#000000');
  readonly brushSize = signal(5);

  readonly palette: readonly string[] = [
    '#000000',
    '#ffffff',
    '#7a5cff',
    '#d6336c',
    '#ffb703',
    '#2ec27e',
    '#1e90ff',
  ];

  readonly extendedPalette: readonly string[] = [
    '#d62828',
    '#fb8500',
    '#f9c74f',
    '#fff59d',
    '#aed581',
    '#4caf50',
    '#006064',
    '#80deea',
    '#1565c0',
    '#000080',
    '#b39ddb',
    '#ce93d8',
    '#f48fb1',
    '#ff6f61',
    '#ff8a65',
    '#ffb4a2',
    '#a0522d',
    '#5d4037',
    '#8d99ae',
    '#495057',
  ];

  readonly activeTab = signal<CanvasTab>('reference');
  readonly showSpectatorHelp = signal(false);
  readonly showExtendedPalette = signal(false);

  // Visible only on the describer's mirror canvas — hides during non-spectator play.
  readonly mirrorMounted = computed(() => {
    if (this.game.myRole() !== 'describer') return false;
    const phase = this.game.phase();
    if (phase === 'reveal') return true;
    if (phase === 'playing') return this.game.spectator();
    return false;
  });

  // Two-tab layout kicks in for describer-during-play (spectator) and either role at reveal.
  readonly showTabs = computed(() => {
    const phase = this.game.phase();
    const role = this.game.myRole();
    if (phase === 'reveal') return true;
    if (phase === 'playing' && role === 'describer' && this.game.spectator()) return true;
    return false;
  });

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

    // Pick a sensible default tab whenever phase or role changes.
    effect(() => {
      const phase = this.game.phase();
      const role = this.game.myRole();
      if (phase === 'reveal') {
        this.activeTab.set(role === 'drawer' ? 'reference' : 'drawing');
      } else if (phase === 'playing') {
        this.activeTab.set(role === 'describer' ? 'reference' : 'drawing');
      } else {
        this.activeTab.set('reference');
      }
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

    this.socket.drawReplay$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((strokes) => {
      this.applyReplay(strokes);
    });

    this.socket.drawClear$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.canvasDir?.clear();
    });

    this.socket.drawUndo$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.canvasDir?.undo();
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

  async toggleSurpriseMode(event: Event): Promise<void> {
    const checked = (event.target as HTMLInputElement).checked;
    // Surprise mode = describer is NOT a spectator.
    const res = await this.socket.setSpectator(!checked);
    if (!res.ok) {
      this.errorMsg.set(res.error ?? 'Could not change setting');
      // Revert UI on failure — broadcast will re-sync but the checkbox is mid-flip.
      (event.target as HTMLInputElement).checked = !checked;
    }
  }

  toggleSpectatorHelp(): void {
    this.showSpectatorHelp.update((v) => !v);
  }

  setTab(tab: CanvasTab): void {
    this.activeTab.set(tab);
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

  undo(): void {
    if (!this.canvasDir?.undo()) return;
    this.socket.sendUndo();
  }

  toggleExtendedPalette(): void {
    this.showExtendedPalette.update((v) => !v);
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

  myRoleIs(role: Role): boolean {
    return this.game.myRole() === role;
  }

  // Replay buffered strokes onto the describer's mirror canvas. The canvas is
  // only mounted after phase flips to 'reveal' and ResizeObserver sizes it,
  // so retry across a few frames until both conditions hold.
  private applyReplay(strokes: DrawStroke[], retries = 12): void {
    const canvas = this.canvasEl?.nativeElement;
    if (!this.canvasDir || !canvas || canvas.width === 0) {
      if (retries <= 0) return;
      requestAnimationFrame(() => this.applyReplay(strokes, retries - 1));
      return;
    }
    this.canvasDir.clear();
    for (const s of strokes) this.canvasDir.applyStroke(s);
  }
}
