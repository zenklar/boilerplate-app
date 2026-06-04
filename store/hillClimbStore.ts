import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BEST_KEY = '@hillclimb/best_distance';
const RUNS_KEY = '@hillclimb/runs';

export type HillClimbRun = {
  id: string;
  distance: number;
  coinsCollected: number;
  carId: string;
  date: number;
};

type HillClimbStore = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
  bestDistance: number;
  runs: HillClimbRun[];
  addRun: (run: HillClimbRun) => void;
  load: () => Promise<void>;
};

export const useHillClimbStore = create<HillClimbStore>((set, get) => ({
  isGamePlaying: false,
  setIsGamePlaying: (v) => set({ isGamePlaying: v }),

  bestDistance: 0,
  runs: [],

  addRun: (run) => {
    const runs = [run, ...get().runs].slice(0, 20);
    const best = Math.max(get().bestDistance, run.distance);
    set({ runs, bestDistance: best });
    AsyncStorage.setItem(BEST_KEY, String(best));
    AsyncStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  },

  load: async () => {
    const [b, r] = await Promise.all([
      AsyncStorage.getItem(BEST_KEY),
      AsyncStorage.getItem(RUNS_KEY),
    ]);
    set({
      bestDistance: b ? parseInt(b, 10) : 0,
      runs: r ? JSON.parse(r) : [],
    });
  },
}));
