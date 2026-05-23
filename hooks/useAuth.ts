import { Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProfileStore } from '../store/profileStore';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { setProfile, clearProfile } = useProfileStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) {
          await fetchProfile(session.user);
        } else {
          clearProfile();
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(user: User) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) setProfile(data);
  }

  return { session, loading };
}
