import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = '@tetris/high_score';
const RUNS_KEY = '@tetris/runs';

export type TetrisRun = {
  id: string;
  score: number;
  lines: number;
  level: number;
  durationMs: number;
  date: number;
};

type TetrisStore = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
  highScore: number;
  updateHighScore: (score: number) => void;
  loadHighScore: () => Promise<void>;
  runs: TetrisRun[];
  addRun: (run: TetrisRun) => void;
  loadRuns: () => Promise<void>;
};

export const useTetrisStore = create<TetrisStore>((set, get) => ({
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
    const next = [run, ...get().runs].sort((a, b) => b.score - a.score).slice(0, 10);
    set({ runs: next });
    AsyncStorage.setItem(RUNS_KEY, JSON.stringify(next));
  },
  loadRuns: async () => {
    const v = await AsyncStorage.getItem(RUNS_KEY);
    if (v) { try { set({ runs: JSON.parse(v) }); } catch (_) {} }
  },
}));
