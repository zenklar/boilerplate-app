import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameRun } from '../components/game/GameLeaderboard';

const MAX_RUNS = 10;

export type GameSessionStore<R extends GameRun> = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
  highScore: number;
  updateHighScore: (score: number) => void;
  loadHighScore: () => Promise<void>;
  runs: R[];
  addRun: (run: R) => void;
  loadRuns: () => Promise<void>;
};

/**
 * Factory for the standard per-game session store. Each new game can call
 * this with a unique `id` and get a fully wired zustand store with
 * AsyncStorage persistence for the high score and recent runs.
 *
 *   export const useFooStore = createGameSessionStore<FooRun>('foo');
 *
 * Keys used: `@<id>/high_score` and `@<id>/runs`.
 */
export function createGameSessionStore<R extends GameRun>(id: string) {
  const HIGH_SCORE_KEY = `@${id}/high_score`;
  const RUNS_KEY = `@${id}/runs`;

  return create<GameSessionStore<R>>((set, get) => ({
    isGamePlaying: false,
    setIsGamePlaying: (v) => set({ isGamePlaying: v }),

    highScore: 0,
    updateHighScore: (score) => {
      if (score > get().highScore) {
        set({ highScore: score });
        AsyncStorage.setItem(HIGH_SCORE_KEY, String(score));
      }
    },
    loadHighScore: async () => {
      const v = await AsyncStorage.getItem(HIGH_SCORE_KEY);
      if (v) set({ highScore: parseInt(v, 10) });
    },

    runs: [],
    addRun: (run) => {
      const next = [run, ...get().runs].slice(0, MAX_RUNS);
      set({ runs: next });
      AsyncStorage.setItem(RUNS_KEY, JSON.stringify(next));
    },
    loadRuns: async () => {
      const v = await AsyncStorage.getItem(RUNS_KEY);
      if (v) { try { set({ runs: JSON.parse(v) }); } catch (_) {} }
    },
  }));
}
