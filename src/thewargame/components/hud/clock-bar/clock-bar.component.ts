import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ClockService, formatGameDate } from '../../../services/clock.service';
import type { Speed } from '../../../services/clock.service';
import { GameService } from '../../../services/game.service';

interface SpeedButton {
  readonly value: Speed;
  readonly label: string;
  readonly hint: string;
}

const SPEED_BUTTONS: ReadonlyArray<SpeedButton> = [
  { value: 1, label: '1×', hint: 'Slow (1)' },
  { value: 5, label: '5×', hint: 'Normal (2)' },
  { value: 20, label: '20×', hint: 'Fast (3)' },
];

@Component({
  selector: 'wg-clock-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './clock-bar.component.html',
  styleUrl: './clock-bar.component.scss',
})
export class ClockBarComponent {
  private readonly clock = inject(ClockService);
  private readonly game = inject(GameService);

  readonly speeds = SPEED_BUTTONS;
  readonly paused = this.clock.paused;
  readonly currentSpeed = this.clock.speed;
  readonly ready = this.game.ready;

  readonly dateLabel = computed(() => formatGameDate(this.clock.date()));
  readonly nation = this.game.playerNation;
  readonly dailyIncome = this.game.playerDailyIncome;

  readonly moneyLabel = computed(() => {
    const n = this.nation();
    if (!n) return '—';
    return formatMoney(n.money);
  });

  readonly incomeLabel = computed(() => {
    const i = this.dailyIncome();
    const sign = i >= 0 ? '+' : '−';
    return `${sign}$${Math.abs(i).toFixed(0)}/day`;
  });

  togglePause(): void {
    this.clock.togglePause();
  }

  setSpeed(s: Speed): void {
    this.clock.setSpeed(s);
  }
}

function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
