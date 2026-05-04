import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-menu.component.html',
  styleUrl: './settings-menu.component.scss',
})
export class SettingsMenuComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  protected readonly themeService = inject(ThemeService);

  readonly open = signal(false);

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  onDarkToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.themeService.set(checked ? 'dark' : 'light');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const target = ev.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }
}
