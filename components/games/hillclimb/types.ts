export type CarId = 'jeep' | 'sports' | 'truck' | 'monster';

export interface CarConfig {
  id: CarId;
  name: string;
  description: string;
  image: ReturnType<typeof require>;
  color: string;
  speed: number;    // 1–5 star display
  power: number;
  fuel: number;
  // physics values
  maxSpeed: number;
  enginePower: number;
  fuelRate: number;
  brakePower: number;
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
