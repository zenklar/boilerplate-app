import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COIN_KEY = '@boilerplate/coins';
const INITIAL_BALANCE = 10;

type CoinStore = {
  balance: number;
  loaded: boolean;
  load: () => Promise<void>;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
};

export const useCoinStore = create<CoinStore>((set, get) => ({
  balance: INITIAL_BALANCE,
  loaded: false,

  load: async () => {
    const val = await AsyncStorage.getItem(COIN_KEY);
    if (val !== null) {
      set({ balance: parseInt(val, 10), loaded: true });
    } else {
      await AsyncStorage.setItem(COIN_KEY, String(INITIAL_BALANCE));
      set({ balance: INITIAL_BALANCE, loaded: true });
    }
  },

  addCoins: (amount: number) => {
    const next = get().balance + amount;
    set({ balance: next });
    AsyncStorage.setItem(COIN_KEY, String(next));
  },

  spendCoins: (amount: number) => {
    const current = get().balance;
    if (current < amount) return false;
    const next = current - amount;
    set({ balance: next });
    AsyncStorage.setItem(COIN_KEY, String(next));
    return true;
  },
}));
