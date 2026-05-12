import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapViewComponent } from '../map-view/map-view.component';

@Component({
  selector: 'wg-shell',
  standalone: true,
  imports: [RouterLink, MapViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {}
