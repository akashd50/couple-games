import { Injectable, signal } from '@angular/core';
import type { RegionId } from '../models/game.types';

export interface BuildDialogState {
  readonly regionId: RegionId;
  readonly slotIndex: number;
}

export interface HubInfoDialogState {
  readonly regionId: RegionId;
  readonly hubId: string;
}

@Injectable()
export class DialogsService {
  readonly buildDialog = signal<BuildDialogState | null>(null);
  readonly hubInfoDialog = signal<HubInfoDialogState | null>(null);
  readonly techDialog = signal<boolean>(false);

  openNewBuild(regionId: RegionId, slotIndex: number): void {
    this.buildDialog.set({ regionId, slotIndex });
  }

  closeBuild(): void {
    this.buildDialog.set(null);
  }

  openHubInfo(regionId: RegionId, hubId: string): void {
    this.hubInfoDialog.set({ regionId, hubId });
  }

  closeHubInfo(): void {
    this.hubInfoDialog.set(null);
  }

  openTech(): void {
    this.techDialog.set(true);
  }

  closeTech(): void {
    this.techDialog.set(false);
  }

  closeAll(): void {
    this.buildDialog.set(null);
    this.hubInfoDialog.set(null);
    this.techDialog.set(false);
  }

  anyOpen(): boolean {
    return (
      this.buildDialog() !== null ||
      this.hubInfoDialog() !== null ||
      this.techDialog()
    );
  }
}
