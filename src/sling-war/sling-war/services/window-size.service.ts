import { Injectable, signal, computed, inject, NgZone, DestroyRef } from '@angular/core';
import { fromEvent, Observable } from 'rxjs';
import { debounceTime, map, shareReplay } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface WindowDimensions {
    width: number;
    height: number;
}

@Injectable({
    providedIn: 'root'
})
export class WindowSizeService {
    private ngZone = inject(NgZone);
    private destroyRef = inject(DestroyRef);

    // 1. Create a Signal for easy, reactive layout reads in templates/components
    private dimensionsSignal = signal<WindowDimensions>(this.getCurrentDimensions());

    // Public read-only signals
    readonly dimensions = this.dimensionsSignal.asReadonly();
    readonly width = computed(() => this.dimensionsSignal().width);
    readonly height = computed(() => this.dimensionsSignal().height);

    // 2. Create an Observable stream in case you prefer RxJS operators
    readonly resize$: Observable<WindowDimensions>;

    constructor() {
        // Run the resize listener outside Angular's zone so it doesn't trigger
        // change detection hundreds of times a second while dragging the window.
        this.resize$ = this.ngZone.runOutsideAngular(() =>
            fromEvent(window, 'resize').pipe(
                debounceTime(50), // Smooths out performance
                map(() => this.getCurrentDimensions()),
                shareReplay(1),
                takeUntilDestroyed(this.destroyRef) // Automatic cleanup
            )
        );

        // Subscribe to updates and bring the execution back into Angular's zone
        // ONLY when updating our Signal state.
        this.resize$.subscribe(dims => {
            this.ngZone.run(() => {
                this.dimensionsSignal.set(dims);
            });
        });
    }

    private getCurrentDimensions(): WindowDimensions {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }
}