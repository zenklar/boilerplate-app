import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// v2: lifetime progression — no cycle resets, rewards run day 0–28 then stop
const KEY = '@arcade/dailyLogin_v2';
const MAX_DAY = 28; // day 0 (welcome) + days 1–28
const COINS_PER_DAY = 10;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(isoA: string, isoB: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const a = new Date(isoA).setHours(0, 0, 0, 0);
  const b = new Date(isoB).setHours(0, 0, 0, 0);
  return Math.floor((b - a) / msPerDay);
}

type DailyLoginStore = {
  startDate: string;
  claimedDays: number[]; // global day numbers 0–28 that have been claimed
  isLoaded: boolean;
  load: () => Promise<void>;
  claimDay: (day: number) => void;
  getCurrentDay: () => number; // 0–28, capped — never resets
  coinsPerDay: number;
};

export const useDailyLoginStore = create<DailyLoginStore>((set, get) => ({
  startDate: todayStr(),
  claimedDays: [],
  isLoaded: false,
  coinsPerDay: COINS_PER_DAY,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const saved: { startDate: string; claimedDays: number[] } = JSON.parse(raw);
        set({ startDate: saved.startDate, claimedDays: saved.claimedDays, isLoaded: true });
      } else {
        const fresh = { startDate: todayStr(), claimedDays: [] as number[] };
        await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
        set({ ...fresh, isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  claimDay: (day: number) => {
    const { startDate, claimedDays } = get();
    const next = [...claimedDays, day];
    set({ claimedDays: next });
    AsyncStorage.setItem(KEY, JSON.stringify({ startDate, claimedDays: next }));
  },

  getCurrentDay: () => {
    const { startDate } = get();
    // Day 1 = first visit (welcome), day 2 = first return, …, day 28 = cap
    return Math.min(daysBetween(startDate, todayStr()) + 1, MAX_DAY);
  },
}));
