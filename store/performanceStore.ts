import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const FPS_CAP_KEY = '@settings/fps_cap';

export type FpsCap = 30 | 60 | 120;

type PerformanceStore = {
  fpsCap: FpsCap;
  load: () => Promise<void>;
  setFpsCap: (fps: FpsCap) => Promise<void>;
};

export const usePerformanceStore = create<PerformanceStore>((set) => ({
  fpsCap: 60,

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
}));
