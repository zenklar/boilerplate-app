export type CarId = 'jeep' | 'sports' | 'truck' | 'monster';

export interface CarConfig {
  id: CarId;
  name: string;
  description: string;
  image: ReturnType<typeof require>;
  color: string;
  /** 1–5 star ratings */
  speed: number;
  power: number;
  fuel: number;
  // physics multipliers relative to baseline
  maxSpeed: number;    // px/s
  enginePower: number; // px/s²
  fuelRate: number;    // units/s while on gas
  brakePower: number;  // px/s²
}

export interface GameState {
  carWorldX: number;
  velX: number;
  fuel: number;
  distance: number;
  coinsCollected: number;
  wheelAngle: number;
  stuckTimer: number;
  phase: 'playing' | 'dead' | 'idle';
  deathReason: 'fuel' | 'flipped' | 'backwards' | '';
}

export interface WorldCoin {
  worldX: number;
  worldY: number;
  collected: boolean;
}
