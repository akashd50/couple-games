import type { PowerUp, PROJECTILE_KINDS } from '../../game.types';

export const POWER_UPS: PowerUp[] = [
  {
    id: 'heavy_ammo',
    label: 'Heavy Ammo',
    description: 'Next projectile weighs 3x (more damage)',
    cost: 1,
    projectileType: 'heavy' as (typeof PROJECTILE_KINDS)[number],
  },
  {
    id: 'explosive_shot',
    label: 'Explosive Shot',
    description: 'Next projectile explodes on impact',
    cost: 2,
    projectileType: 'explosive' as (typeof PROJECTILE_KINDS)[number],
  },
];
