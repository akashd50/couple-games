import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { NewsService } from '../../../services/news.service';
import type { NewsCategory, NewsEvent } from '../../../models/events.types';

const CATEGORY_ICON: Record<NewsCategory, string> = {
  system: '⚙',
  market: '$',
  diplomacy: '⚐',
  intel: '◉',
  combat: '✶',
};

@Component({
  selector: 'wg-news-ticker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './news-ticker.component.html',
  styleUrl: './news-ticker.component.scss',
})
export class NewsTickerComponent {
  private readonly news = inject(NewsService);

  readonly open = signal(false);
  readonly latest = this.news.latest;
  readonly events = this.news.events;

  readonly hasEvents = computed(() => this.events().length > 0);

  iconFor(category: NewsCategory): string {
    return CATEGORY_ICON[category] ?? '•';
  }

  trackEvent(_: number, e: NewsEvent): number {
    return e.id;
  }

  toggle(): void {
    if (!this.hasEvents()) return;
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }
}
