import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TECH_TREE } from '../../../data/tech-tree';
import type { TechNode } from '../../../data/tech-tree';
import { ClockService } from '../../../services/clock.service';
import { DialogsService } from '../../../services/dialogs.service';
import { ResearchService } from '../../../services/research.service';

interface NodeLayout {
  readonly node: TechNode;
  readonly x: number;
  readonly y: number;
  readonly unlocked: boolean;
  readonly canUnlock: { ok: boolean; reason?: string };
}

interface EdgeLayout {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly active: boolean;
}

const COL_GAP = 220;
const ROW_GAP = 140;
const NODE_W = 180;
const NODE_H = 90;
const PADDING = 24;

@Component({
  selector: 'wg-tech-tree-dialog',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tech-tree-dialog.component.html',
  styleUrl: './tech-tree-dialog.component.scss',
})
export class TechTreeDialogComponent {
  private readonly dialogs = inject(DialogsService);
  private readonly research = inject(ResearchService);
  private readonly clock = inject(ClockService);

  readonly open = this.dialogs.techDialog;
  readonly points = this.research.points;
  readonly unlocked = this.research.unlocked;
  readonly selectedNodeId = signal<string | null>(null);

  readonly nodes = computed<NodeLayout[]>(() =>
    TECH_TREE.map((node) => ({
      node,
      x: PADDING + node.col * COL_GAP,
      y: PADDING + node.row * ROW_GAP,
      unlocked: this.unlocked().has(node.id),
      canUnlock: this.research.canUnlock(node.id),
    })),
  );

  readonly edges = computed<EdgeLayout[]>(() => {
    const out: EdgeLayout[] = [];
    const byId = new Map(this.nodes().map((n) => [n.node.id, n]));
    for (const n of this.nodes()) {
      for (const prereq of n.node.prerequisites) {
        const from = byId.get(prereq);
        if (!from) continue;
        out.push({
          id: `${prereq}->${n.node.id}`,
          x1: from.x + NODE_W,
          y1: from.y + NODE_H / 2,
          x2: n.x,
          y2: n.y + NODE_H / 2,
          active: from.unlocked,
        });
      }
    }
    return out;
  });

  readonly viewBox = computed<string>(() => {
    let maxCol = 0;
    let maxRow = 0;
    for (const n of TECH_TREE) {
      if (n.col > maxCol) maxCol = n.col;
      if (n.row > maxRow) maxRow = n.row;
    }
    const w = PADDING * 2 + maxCol * COL_GAP + NODE_W;
    const h = PADDING * 2 + maxRow * ROW_GAP + NODE_H;
    return `0 0 ${w} ${h}`;
  });

  readonly selectedNode = computed<NodeLayout | null>(() => {
    const id = this.selectedNodeId();
    if (!id) return null;
    return this.nodes().find((n) => n.node.id === id) ?? null;
  });

  readonly nodeW = NODE_W;
  readonly nodeH = NODE_H;

  selectNode(id: string): void {
    this.selectedNodeId.set(id);
  }

  branchClass(branch: string): string {
    return `branch--${branch}`;
  }

  unlock(): void {
    const sel = this.selectedNode();
    if (!sel) return;
    if (!sel.canUnlock.ok) return;
    if (this.research.unlock(sel.node.id, this.clock.date())) {
      this.selectedNodeId.set(null);
    }
  }

  close(): void {
    this.dialogs.closeTech();
    this.selectedNodeId.set(null);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open()) this.close();
  }
}
