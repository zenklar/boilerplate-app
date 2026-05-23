import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HIGH_SCORE_KEY = '@asteroids/high_score';

type GameUIStore = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
  highScore: number;
  updateHighScore: (score: number) => void;
  loadHighScore: () => Promise<void>;
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
}));
