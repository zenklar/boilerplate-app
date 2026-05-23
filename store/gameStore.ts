import { create } from 'zustand';

type GameUIStore = {
  isGamePlaying: boolean;
  setIsGamePlaying: (v: boolean) => void;
};

export const useGameUIStore = create<GameUIStore>((set) => ({
  isGamePlaying: false,
  setIsGamePlaying: (v) => set({ isGamePlaying: v }),
}));
