import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const FPS_CAP_KEY = '@settings/fps_cap';

export type FpsCap = 30 | 60 | 120;

type PerformanceStore = {
  fpsCap: FpsCap;
  adaptiveEffectsBudget: number;
  load: () => Promise<void>;
  setFpsCap: (fps: FpsCap) => Promise<void>;
  setAdaptiveEffectsBudget: (budget: number) => void;
};

export const usePerformanceStore = create<PerformanceStore>((set) => ({
  fpsCap: 60,
  adaptiveEffectsBudget: 1,

  load: async () => {
    const raw = await AsyncStorage.getItem(FPS_CAP_KEY);
    if (raw === '30' || raw === '60' || raw === '120') {
      set({ fpsCap: Number(raw) as FpsCap });
      return;
    }
    set({ fpsCap: 60 });
  },

  setFpsCap: async (fps) => {
    set({ fpsCap: fps });
    await AsyncStorage.setItem(FPS_CAP_KEY, String(fps));
  },

  setAdaptiveEffectsBudget: (budget) => {
    const clamped = Math.max(0.35, Math.min(1, budget));
    // Smooth transitions to avoid visible quality flicker.
    set((state) => ({
      adaptiveEffectsBudget: state.adaptiveEffectsBudget * 0.8 + clamped * 0.2,
    }));
  },
}));
