import type { Graphics } from 'pixi.js';
import type { HubKind } from '../models/game.types';

/**
 * Per-hub SVG snippets, drawn inside a 24x24 viewBox with `fill="none"` and
 * `stroke="currentColor"`. Re-used by the HubIcon Angular component.
 */
export const HUB_SVG: Record<HubKind, string> = {
  refinery: `
    <rect x="6" y="5" width="12" height="15" rx="1" />
    <line x1="6" y1="10" x2="18" y2="10" />
    <line x1="6" y1="15" x2="18" y2="15" />
    <line x1="10" y1="5" x2="10" y2="3" />
    <line x1="14" y1="5" x2="14" y2="3" />
  `,
  mine: `
    <polygon points="12,4 22,20 2,20" />
    <polyline points="7,20 12,13 17,20" />
  `,
  research_lab: `
    <line x1="9" y1="3" x2="15" y2="3" />
    <path d="M10 3v5l-5 11a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-11V3" />
    <line x1="7.5" y1="14" x2="16.5" y2="14" />
  `,
  intel_agency: `
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  `,
  defense_plant: `
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <polyline points="9,12 11.5,14.5 16,10" />
  `,
};

/**
 * Draws a stylized kind glyph centered at (x, y) into a Pixi Graphics.
 * `size` is the half-extent (full glyph fits in 2*size).
 */
export function drawHubGlyph(
  g: Graphics,
  kind: HubKind,
  x: number,
  y: number,
  size: number,
  color: number,
): void {
  const lineW = Math.max(0.18, size * 0.18);
  const stroke = { color, width: lineW, alpha: 1, pixelLine: true };
  const s = size;
  switch (kind) {
    case 'refinery': {
      g.rect(x - s * 0.55, y - s * 0.7, s * 1.1, s * 1.4);
      g.stroke(stroke);
      g.moveTo(x - s * 0.55, y - s * 0.2).lineTo(x + s * 0.55, y - s * 0.2);
      g.moveTo(x - s * 0.55, y + s * 0.25).lineTo(x + s * 0.55, y + s * 0.25);
      g.stroke(stroke);
      break;
    }
    case 'mine': {
      g.moveTo(x - s, y + s * 0.75)
        .lineTo(x, y - s * 0.75)
        .lineTo(x + s, y + s * 0.75)
        .lineTo(x - s, y + s * 0.75);
      g.stroke(stroke);
      g.moveTo(x - s * 0.4, y + s * 0.75)
        .lineTo(x, y + s * 0.1)
        .lineTo(x + s * 0.4, y + s * 0.75);
      g.stroke(stroke);
      break;
    }
    case 'research_lab': {
      g.moveTo(x - s * 0.3, y - s * 0.8).lineTo(x + s * 0.3, y - s * 0.8);
      g.stroke(stroke);
      g.moveTo(x - s * 0.3, y - s * 0.8)
        .lineTo(x - s * 0.3, y - s * 0.2)
        .lineTo(x - s * 0.85, y + s * 0.8)
        .lineTo(x + s * 0.85, y + s * 0.8)
        .lineTo(x + s * 0.3, y - s * 0.2)
        .lineTo(x + s * 0.3, y - s * 0.8);
      g.stroke(stroke);
      break;
    }
    case 'intel_agency': {
      g.ellipse(x, y, s * 0.95, s * 0.55);
      g.stroke(stroke);
      g.circle(x, y, s * 0.32).fill({ color });
      break;
    }
    case 'defense_plant': {
      g.moveTo(x, y - s * 0.85)
        .lineTo(x + s * 0.78, y - s * 0.5)
        .lineTo(x + s * 0.78, y + s * 0.15)
        .lineTo(x, y + s * 0.85)
        .lineTo(x - s * 0.78, y + s * 0.15)
        .lineTo(x - s * 0.78, y - s * 0.5)
        .lineTo(x, y - s * 0.85);
      g.stroke(stroke);
      break;
    }
  }
}
