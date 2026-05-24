// Lore/data for each enemy saucer design. The id matches the sprite id in
// constants/enemyImages.ts (and assets/ships/enemy/enemy_NN.png).
export type EnemyDef = {
  id: number;
  name: string;
};

export const ENEMIES: EnemyDef[] = [
  { id:  1, name: 'SCOUT-A' },
  { id:  2, name: 'SCOUT-B' },
  { id:  3, name: 'SCOUT-C' },
  { id:  4, name: 'RAIDER MK-I' },
  { id:  5, name: 'RAIDER MK-II' },
  { id:  6, name: 'RAIDER MK-III' },
  { id:  7, name: 'INTERCEPTOR' },
  { id:  8, name: 'STRIKER' },
  { id:  9, name: 'HUNTER' },
  { id: 10, name: 'PROWLER' },
  { id: 11, name: 'WRAITH' },
  { id: 12, name: 'REAPER' },
  { id: 13, name: 'SPECTRE' },
  { id: 14, name: 'VOID-WALKER' },
  { id: 15, name: 'DESTROYER' },
  { id: 16, name: 'ANNIHILATOR' },
  { id: 17, name: 'OVERLORD' },
  { id: 18, name: 'WARLORD' },
];
