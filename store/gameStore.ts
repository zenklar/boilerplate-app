import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HIGH_SCORE_KEY = '@asteroids/high_score';
export const RUNS_KEY = '@asteroids/runs';

export type RunRecord = {
  id: string;
  score: number;
  bulletsShot: number;
  asteroidsDestroyed: number;
  durationMs: number;
  date: number;
};

type GameUIStore = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
  highScore: number;
  updateHighScore: (score: number) => void;
  loadHighScore: () => Promise<void>;
  runs: RunRecord[];
  addRun: (run: RunRecord) => void;
  loadRuns: () => Promise<void>;
};

export const useGameUIStore = create<GameUIStore>((set, get) => ({
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
    const next = [run, ...get().runs].slice(0, 10);
    set({ runs: next });
    AsyncStorage.setItem(RUNS_KEY, JSON.stringify(next));
  },
  loadRuns: async () => {
    const v = await AsyncStorage.getItem(RUNS_KEY);
    if (v) { try { set({ runs: JSON.parse(v) }); } catch (_) {} }
  },
}));
