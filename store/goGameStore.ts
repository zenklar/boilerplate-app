import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = '@go/high_score';
const RUNS_KEY       = '@go/runs';

export type GoRunRecord = {
  id: string;
  score: number;
  captures: number;
  durationMs: number;
  playerColor: 'black' | 'white';
  won: boolean;
  date: number;
};

type GoGameStore = {
  highScore: number;
  updateHighScore: (score: number) => void;
  loadHighScore: () => Promise<void>;
  runs: GoRunRecord[];
  addRun: (run: GoRunRecord) => void;
  loadRuns: () => Promise<void>;
};

export const useGoGameStore = create<GoGameStore>((set, get) => ({
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
