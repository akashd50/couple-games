import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { MapService } from '../../services/map.service';
import { RegionTooltipComponent } from '../hud/region-tooltip/region-tooltip.component';

@Component({
  selector: 'wg-map-view',
  standalone: true,
  imports: [RegionTooltipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss',
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { static: true })
  private hostRef!: ElementRef<HTMLDivElement>;

  private readonly map = inject(MapService);

  ngAfterViewInit(): void {
    void this.map.init(this.hostRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.map.destroy();
  }
}
