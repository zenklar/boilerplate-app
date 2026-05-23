import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COINS_KEY = '@arcade/coins';

type CoinStore = {
  coins: number;
  addCoins: (amount: number) => void;
  spendCoin: () => boolean;
  loadCoins: () => Promise<void>;
};

export const useCoinStore = create<CoinStore>((set, get) => ({
  coins: 0,

  addCoins: (amount) => {
    const next = get().coins + amount;
    set({ coins: next });
    AsyncStorage.setItem(COINS_KEY, String(next));
  },

  spendCoin: () => {
    if (get().coins < 1) return false;
    const next = get().coins - 1;
    set({ coins: next });
    AsyncStorage.setItem(COINS_KEY, String(next));
    return true;
  },

  loadCoins: async () => {
    const v = await AsyncStorage.getItem(COINS_KEY);
    if (v) set({ coins: parseInt(v, 10) });
  },
}));
