import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapViewComponent } from '../map-view/map-view.component';
import { DebugPanelComponent } from '../hud/debug-panel/debug-panel.component';
import { ClockBarComponent } from '../hud/clock-bar/clock-bar.component';
import { NewsTickerComponent } from '../hud/news-ticker/news-ticker.component';
import { MapService } from '../../services/map.service';
import { ClockService, formatGameDate } from '../../services/clock.service';
import { AiService } from '../../services/ai.service';
import { GameService } from '../../services/game.service';
import { NewsService } from '../../services/news.service';
import { ResourceService } from '../../services/resource.service';

@Component({
  selector: 'wg-shell',
  standalone: true,
  imports: [
    RouterLink,
    MapViewComponent,
    DebugPanelComponent,
    ClockBarComponent,
    NewsTickerComponent,
  ],
  providers: [MapService, ClockService, NewsService, ResourceService, GameService, AiService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly clock = inject(ClockService);
  private readonly game = inject(GameService);
  private readonly ai = inject(AiService);
  private readonly news = inject(NewsService);

  async ngOnInit(): Promise<void> {
    await this.game.init();
    this.ai.init();
    const start = formatGameDate(this.clock.date());
    this.news.push({
      date: start,
      category: 'system',
      severity: 'info',
      headline: 'Administration sworn in. Press play to begin.',
    });
  }

  ngOnDestroy(): void {
    // Pause so the RAF loop doesn't keep emitting after navigation.
    this.clock.pause();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (isTypingTarget(e.target)) return;
    switch (e.key) {
      case ' ': // Space
        e.preventDefault();
        this.clock.togglePause();
        break;
      case '1':
        this.clock.setSpeed(1);
        break;
      case '2':
        this.clock.setSpeed(5);
        break;
      case '3':
        this.clock.setSpeed(20);
        break;
    }
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
  );
}
