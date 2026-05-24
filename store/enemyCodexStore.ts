import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENCOUNTERED_KEY = '@asteroids/enemy_encountered';
const KILLED_KEY = '@asteroids/enemy_killed';

type Persisted = {
  /** Set of designIds the player has seen on screen. */
  encountered: Record<number, true>;
  /** Set of designIds the player has destroyed. */
  killed: Record<number, true>;
};

type EnemyCodexStore = Persisted & {
  markEncountered: (id: number) => void;
  markKilled: (id: number) => void;
  load: () => Promise<void>;
  reset: () => Promise<void>;
};

const writeSet = async (key: string, obj: Record<number, true>) => {
  await AsyncStorage.setItem(key, JSON.stringify(Object.keys(obj).map(Number)));
};
const readSet = async (key: string): Promise<Record<number, true>> => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  try {
    const ids: number[] = JSON.parse(raw);
    const out: Record<number, true> = {};
    for (const id of ids) out[id] = true;
    return out;
  } catch {
    return {};
  }
};

export const useEnemyCodexStore = create<EnemyCodexStore>((set, get) => ({
  encountered: {},
  killed: {},
  markEncountered: (id) => {
    if (get().encountered[id]) return;
    const next = { ...get().encountered, [id]: true as const };
    set({ encountered: next });
    writeSet(ENCOUNTERED_KEY, next);
  },
  markKilled: (id) => {
    // Killing implies encountering — update both atomically.
    const enc = get().encountered;
    const kil = get().killed;
    const encNext = enc[id] ? enc : { ...enc, [id]: true as const };
    if (kil[id]) {
      if (encNext !== enc) {
        set({ encountered: encNext });
        writeSet(ENCOUNTERED_KEY, encNext);
      }
      return;
    }
    const kilNext = { ...kil, [id]: true as const };
    set({ encountered: encNext, killed: kilNext });
    writeSet(ENCOUNTERED_KEY, encNext);
    writeSet(KILLED_KEY, kilNext);
  },
  load: async () => {
    const [encountered, killed] = await Promise.all([
      readSet(ENCOUNTERED_KEY),
      readSet(KILLED_KEY),
    ]);
    set({ encountered, killed });
  },
  reset: async () => {
    set({ encountered: {}, killed: {} });
    await AsyncStorage.multiRemove([ENCOUNTERED_KEY, KILLED_KEY]);
  },
}));
