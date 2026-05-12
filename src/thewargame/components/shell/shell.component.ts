import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapViewComponent } from '../map-view/map-view.component';
import { DebugPanelComponent } from '../hud/debug-panel/debug-panel.component';
import { MapService } from '../../services/map.service';

@Component({
  selector: 'wg-shell',
  standalone: true,
  imports: [RouterLink, MapViewComponent, DebugPanelComponent],
  providers: [MapService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}
