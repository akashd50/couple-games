import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SettingsMenuComponent } from '../shared/components/settings-menu/settings-menu.component';
import { ThemeService } from '../shared/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SettingsMenuComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('couple-games');
  // Inject so the service constructor effect runs and applies the saved theme.
  private readonly theme = inject(ThemeService);
}
