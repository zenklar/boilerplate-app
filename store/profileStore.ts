import { create } from 'zustand';

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  subscription_status: 'free' | 'pro' | 'cancelled';
  created_at: string;
};

type ProfileStore = {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  clearProfile: () => void;
};

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clearProfile: () => set({ profile: null }),
}));
