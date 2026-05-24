import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = '@snake/high_score';
const RUNS_KEY = '@snake/runs';

export type SnakeRun = {
  id: string;
  score: number;
  foodEaten: number;
  level: number;
  durationMs: number;
  date: number;
};

type SnakeStore = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
  highScore: number;
  updateHighScore: (score: number) => void;
  loadHighScore: () => Promise<void>;
  runs: SnakeRun[];
  addRun: (run: SnakeRun) => void;
  loadRuns: () => Promise<void>;
};

export const useSnakeStore = create<SnakeStore>((set, get) => ({
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
