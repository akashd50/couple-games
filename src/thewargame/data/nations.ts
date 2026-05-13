import type { Nation, NationId } from '../models/game.types';
import { emptyBag } from './balance';

export const PLAYER_NATION_ID: NationId = 'USA';

interface NationSeed {
  readonly id: NationId;
  readonly name: string;
  readonly accent: string;
  readonly stance: Nation['stance'];
  readonly initialRelations: ReadonlyArray<readonly [NationId, number]>;
}

export const NATION_SEEDS: ReadonlyArray<NationSeed> = [
  {
    id: 'USA',
    name: 'United States',
    accent: '#3a6df0',
    stance: 'player',
    initialRelations: [
      ['CAN', 55],
      ['MEX', 25],
    ],
  },
  {
    id: 'CAN',
    name: 'Canada',
    accent: '#d6336c',
    stance: 'defensive',
    initialRelations: [
      ['USA', 55],
      ['MEX', 20],
    ],
  },
];

export function buildNation(seed: NationSeed, regionIds: ReadonlyArray<string>): Nation {
  const relations: Record<NationId, number> = {};
  for (const [k, v] of seed.initialRelations) relations[k] = v;
  return {
    id: seed.id,
    name: seed.name,
    accent: seed.accent,
    money: 0,
    stockpiles: emptyBag(),
    relations,
    regionIds,
    stance: seed.stance,
  };
}
