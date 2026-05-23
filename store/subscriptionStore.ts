import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUB_KEY = '@arcade/subscription';

type SubscriptionStore = {
  isSubscribed: boolean;
  loadSubscription: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
};

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  isSubscribed: false,

  loadSubscription: async () => {
    const v = await AsyncStorage.getItem(SUB_KEY);
    if (v === 'true') set({ isSubscribed: true });
  },

  subscribe: () => {
    set({ isSubscribed: true });
    AsyncStorage.setItem(SUB_KEY, 'true');
  },

  unsubscribe: () => {
    set({ isSubscribed: false });
    AsyncStorage.removeItem(SUB_KEY);
  },
}));
