import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
} from '@angular/core';
import { GameRenderer } from '../../pixi/game-renderer';

@Component({
    selector: 'rl-game-canvas',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './game-canvas.component.html',
    styleUrls: ['./game-canvas.component.scss'],
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
    @ViewChild('host', { static: true })
    private hostRef!: ElementRef<HTMLDivElement>;

    private readonly renderer = new GameRenderer();

    ngAfterViewInit(): void {
        void this.renderer.init(this.hostRef.nativeElement);
    }

    ngOnDestroy(): void {
        this.renderer.destroy();
    }
}
