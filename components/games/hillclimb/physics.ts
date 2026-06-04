import { GameState, WorldCoin, CarConfig } from './types';
import { terrainAngle, terrainY } from './terrain';

const GRAVITY = 980;
const ROLLING_FRICTION = 25;
const FUEL_IDLE_DRAIN = 0.4;
const MAX_STUCK_ANGLE_DEG = 68;
const STUCK_DEATH_TIMER = 1.8;
const COIN_CATCH_RADIUS_X = 70;
const COIN_CATCH_RADIUS_Y = 50;

export interface PhysicsInput {
  gasPressed: boolean;
  brakePressed: boolean;
  car: CarConfig;
  gameHeight: number;
  coins: WorldCoin[];
}

export function stepPhysics(state: GameState, input: PhysicsInput, dt: number): GameState {
  if (state.phase !== 'playing') return state;

  const { gasPressed, brakePressed, car, gameHeight, coins } = input;
  const clampedDt = Math.min(dt, 0.05);

  const angle = terrainAngle(state.carWorldX, gameHeight);
  const angleDeg = angle * (180 / Math.PI);
  const gravityX = GRAVITY * Math.sin(angle);

  let accel = -gravityX;
  if (gasPressed) accel += car.enginePower;
  else if (brakePressed) accel -= car.brakePower;
  if (state.velX > 0) accel -= ROLLING_FRICTION;
  else if (state.velX < 0) accel += ROLLING_FRICTION;

  let velX = state.velX + accel * clampedDt + gravityX * clampedDt;
  velX = Math.max(-60, Math.min(car.maxSpeed, velX));

  const carWorldX = state.carWorldX + velX * clampedDt;
  const fuel = Math.max(0, state.fuel - (FUEL_IDLE_DRAIN + (gasPressed ? car.fuelRate : 0)) * clampedDt);
  const wheelAngle = state.wheelAngle + (velX / (2 * Math.PI * 18)) * 360 * clampedDt;

  let coinsCollected = state.coinsCollected;
  const groundY = terrainY(carWorldX, gameHeight);
  for (const coin of coins) {
    if (!coin.collected) {
      if (Math.abs(coin.worldX - carWorldX) < COIN_CATCH_RADIUS_X &&
          Math.abs(coin.worldY - groundY) < COIN_CATCH_RADIUS_Y) {
        coin.collected = true;
        coinsCollected++;
      }
    }
  }

  const distance = Math.max(state.distance, Math.round(carWorldX / 10));

  let stuckTimer = state.stuckTimer;
  if (Math.abs(angleDeg) > MAX_STUCK_ANGLE_DEG && Math.abs(velX) < 15) stuckTimer += clampedDt;
  else stuckTimer = 0;

  if (fuel <= 0)            return { ...state, carWorldX, velX: 0, fuel: 0, distance, coinsCollected, wheelAngle, stuckTimer, phase: 'dead', deathReason: 'fuel' };
  if (carWorldX < -150)     return { ...state, carWorldX, velX, fuel, distance, coinsCollected, wheelAngle, stuckTimer, phase: 'dead', deathReason: 'backwards' };
  if (stuckTimer >= STUCK_DEATH_TIMER) return { ...state, carWorldX, velX: 0, fuel, distance, coinsCollected, wheelAngle, stuckTimer, phase: 'dead', deathReason: 'flipped' };

  return { carWorldX, velX, fuel, distance, coinsCollected, wheelAngle, stuckTimer, phase: 'playing', deathReason: '' };
}

export function initialGameState(): GameState {
  return { carWorldX: 200, velX: 0, fuel: 100, distance: 0, coinsCollected: 0, wheelAngle: 0, stuckTimer: 0, phase: 'playing', deathReason: '' };
}
