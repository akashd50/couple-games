import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { DrawStroke, StrokePhase } from '../models/game.types';

// Renders strokes onto a canvas and (when interactive) emits stroke events
// in normalized 0..1 coordinates so the receiving end can replay regardless
// of canvas size. Works with both touch and mouse input.
@Directive({
  selector: 'canvas[msDrawCanvas]',
  standalone: true,
})
export class DrawCanvasDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLCanvasElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  @Input() interactive = true;
  @Input() color = '#1c1d28';
  @Input() size = 4;

  @Output() readonly stroke = new EventEmitter<DrawStroke>();

  private ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private rafPending = false;

  // Tracks last drawn point per stroke id so we can connect line segments.
  private lastPoints = new Map<number, { x: number; y: number }>();

  private activeStrokeId: number | null = null;
  private nextStrokeId = 1;

  ngAfterViewInit(): void {
    const canvas = this.host.nativeElement;
    this.ctx = canvas.getContext('2d');
    this.fitCanvas();

    this.resizeObserver = new ResizeObserver(() => this.scheduleFit());
    this.resizeObserver.observe(canvas);

    // Always bind handlers — `interactive` is checked at event time so the
    // input can be toggled (e.g. during reveal) without rebinding.
    this.zone.runOutsideAngular(() => this.bindPointerEvents());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // Public API used by the room component to render incoming strokes.
  applyStroke(s: DrawStroke): void {
    if (!this.ctx) return;
    const canvas = this.host.nativeElement;
    const x = s.x * canvas.width;
    const y = s.y * canvas.height;
    const last = this.lastPoints.get(s.strokeId);

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = s.color;
    this.ctx.fillStyle = s.color;
    this.ctx.lineWidth = s.size * (canvas.width / canvas.clientWidth || 1);

    if (s.phase === 'start' || !last) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.lastPoints.set(s.strokeId, { x, y });
      return;
    }

    if (s.phase === 'move') {
      this.ctx.beginPath();
      this.ctx.moveTo(last.x, last.y);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.lastPoints.set(s.strokeId, { x, y });
      return;
    }

    if (s.phase === 'end') {
      this.lastPoints.delete(s.strokeId);
    }
  }

  clear(): void {
    if (!this.ctx) return;
    const c = this.host.nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.lastPoints.clear();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(e: Event): void {
    e.preventDefault();
  }

  private scheduleFit(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.fitCanvas();
    });
  }

  private fitCanvas(): void {
    const canvas = this.host.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Preserve current contents while resizing the backing buffer.
    const previous = document.createElement('canvas');
    previous.width = canvas.width;
    previous.height = canvas.height;
    if (canvas.width > 0 && canvas.height > 0) {
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
    }

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx && previous.width > 0) {
      ctx.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, canvas.width, canvas.height);
    }
  }

  private bindPointerEvents(): void {
    const canvas = this.host.nativeElement;

    const toNormalized = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
      };
    };

    const emit = (phase: StrokePhase, x: number, y: number) => {
      if (this.activeStrokeId === null) return;
      const s: DrawStroke = {
        phase,
        x,
        y,
        color: this.color,
        size: this.size,
        strokeId: this.activeStrokeId,
      };
      this.applyStroke(s);
      this.zone.run(() => this.stroke.emit(s));
    };

    const onDown = (ev: PointerEvent) => {
      if (!this.interactive) return;
      ev.preventDefault();
      canvas.setPointerCapture?.(ev.pointerId);
      this.activeStrokeId = this.nextStrokeId++;
      const p = toNormalized(ev.clientX, ev.clientY);
      emit('start', p.x, p.y);
    };

    const onMove = (ev: PointerEvent) => {
      if (!this.interactive || this.activeStrokeId === null) return;
      ev.preventDefault();
      const p = toNormalized(ev.clientX, ev.clientY);
      emit('move', p.x, p.y);
    };

    const onUp = (ev: PointerEvent) => {
      if (this.activeStrokeId === null) return;
      const p = toNormalized(ev.clientX, ev.clientY);
      emit('end', p.x, p.y);
      this.activeStrokeId = null;
      canvas.releasePointerCapture?.(ev.pointerId);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);
  }
}
