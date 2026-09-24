import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/*
 * With Supabase configured, sign-in uses Supabase Auth (email + password) and the database's
 * Row Level Security decides what a signed-in user may change.
 * Without it, a DEMO sign-in is used — that is NOT security, anything in the browser can be bypassed.
 */

type Session = { email: string };
type AuthValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const KEY = 'krish-admin-session';
const AuthContext = createContext<AuthValue | null>(null);

function readDemoSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => (supabase ? null : readDemoSession()));
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session?.user.email ? { email: data.session.user.email } : null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s?.user.email ? { email: s.user.email } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
      return;
    }
    await new Promise((r) => setTimeout(r, 450));
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    const next = { email };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ session, loading, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
