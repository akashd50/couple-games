import { Injectable, signal } from '@angular/core';
import type { RegionId } from '../models/game.types';

export interface BuildDialogState {
  readonly regionId: RegionId;
  /** Set for new builds. */
  readonly slotIndex?: number;
  /** Set for upgrades. */
  readonly hubId?: string;
}

@Injectable()
export class DialogsService {
  readonly buildDialog = signal<BuildDialogState | null>(null);
  readonly techDialog = signal<boolean>(false);

  openNewBuild(regionId: RegionId, slotIndex: number): void {
    this.buildDialog.set({ regionId, slotIndex });
  }

  openUpgrade(regionId: RegionId, hubId: string): void {
    this.buildDialog.set({ regionId, hubId });
  }

  closeBuild(): void {
    this.buildDialog.set(null);
  }

  openTech(): void {
    this.techDialog.set(true);
  }

  closeTech(): void {
    this.techDialog.set(false);
  }

  closeAll(): void {
    this.buildDialog.set(null);
    this.techDialog.set(false);
  }

  anyOpen(): boolean {
    return this.buildDialog() !== null || this.techDialog();
  }
}
