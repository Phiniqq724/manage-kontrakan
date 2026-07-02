import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { registerForPushNotifications } from './notifications';
import type { Database } from './supabase-types';

type UserRow = Database['public']['Tables']['users']['Row'];

type AuthContextType = {
  user: UserRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      setUser(data ?? null);
      if (data) {
        try {
          await registerForPushNotifications(data.id);
        } catch (err) {
          console.error("[push] token registration failed:", err);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchUser();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
      // INITIAL_SESSION and TOKEN_REFRESHED are intentionally ignored:
      // INITIAL_SESSION fires immediately on attach (duplicate of the fetchUser() above),
      // TOKEN_REFRESHED is a Supabase session refresh that doesn't need push re-registration.
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
