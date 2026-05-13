export type TechBranch = 'industrial' | 'intel' | 'military';

export interface TechNode {
  readonly id: string;
  readonly name: string;
  readonly branch: TechBranch;
  readonly cost: number;
  readonly prerequisites: ReadonlyArray<string>;
  readonly description: string;
  /** Grid position for SVG layout (col, row). */
  readonly col: number;
  readonly row: number;
}

export const TECH_TREE: ReadonlyArray<TechNode> = [
  {
    id: 'industrial_logistics',
    name: 'Industrial Logistics',
    branch: 'industrial',
    cost: 100,
    prerequisites: [],
    description: 'Streamlines supply chains. +10% revenue from all yields.',
    col: 0,
    row: 0,
  },
  {
    id: 'advanced_refining',
    name: 'Advanced Refining',
    branch: 'industrial',
    cost: 200,
    prerequisites: ['industrial_logistics'],
    description: 'Refineries gain +50% yield bonus from current levels.',
    col: 1,
    row: 0,
  },
  {
    id: 'field_intelligence',
    name: 'Field Intelligence',
    branch: 'intel',
    cost: 150,
    prerequisites: [],
    description: 'Intel agencies generate coverage 50% faster.',
    col: 0,
    row: 1,
  },
  {
    id: 'strategic_air_power',
    name: 'Strategic Air Power',
    branch: 'military',
    cost: 250,
    prerequisites: [],
    description: 'Unlocks the Air Strike weapon doctrine (Phase 4).',
    col: 0,
    row: 2,
  },
  {
    id: 'tactical_nuke_doctrine',
    name: 'Tactical Nuke Doctrine',
    branch: 'military',
    cost: 400,
    prerequisites: ['strategic_air_power'],
    description: 'Unlocks tactical nuclear weapons (Phase 4). Severe diplomatic cost.',
    col: 1,
    row: 2,
  },
  {
    id: 'strategic_defense',
    name: 'Strategic Defense',
    branch: 'military',
    cost: 300,
    prerequisites: [],
    description: 'Reduces damage taken from incoming strikes by 20% (Phase 4).',
    col: 2,
    row: 2,
  },
];

const BY_ID = new Map<string, TechNode>(TECH_TREE.map((n) => [n.id, n]));

export function techNode(id: string): TechNode {
  const n = BY_ID.get(id);
  if (!n) throw new Error(`Unknown tech node: ${id}`);
  return n;
}

export function techNodeOrNull(id: string): TechNode | null {
  return BY_ID.get(id) ?? null;
}
