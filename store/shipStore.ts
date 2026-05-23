import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_SHIP_KEY = '@asteroids/selected_ship';

type ShipStore = {
  selectedShipId: number;
  setSelectedShipId: (id: number) => void;
  loadSelectedShip: () => Promise<void>;
};

export const useShipStore = create<ShipStore>((set) => ({
  selectedShipId: 1,
  setSelectedShipId: (id) => {
    set({ selectedShipId: id });
    AsyncStorage.setItem(SELECTED_SHIP_KEY, String(id));
  },
  loadSelectedShip: async () => {
    const v = await AsyncStorage.getItem(SELECTED_SHIP_KEY);
    if (v) set({ selectedShipId: parseInt(v, 10) });
  },
}));
