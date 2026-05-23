import { useProfileStore } from '../store/profileStore';

export function useSubscription() {
  const profile = useProfileStore((s) => s.profile);
  const status = profile?.subscription_status ?? 'free';
  return {
    status,
    isPro: status === 'pro',
    isFree: status === 'free',
  };
}
