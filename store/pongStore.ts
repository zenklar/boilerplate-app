import { createGameSessionStore } from './createGameSessionStore';

export type PongRun = {
  id: string;
  score: number;          // player points
  durationMs: number;
  date: number;
  cpuScore: number;
  longestRally: number;
};

export const usePongStore = createGameSessionStore<PongRun>('pong');
