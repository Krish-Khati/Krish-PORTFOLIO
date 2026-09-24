import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

/*
 * DEMO sign-in only — this is NOT security. Anything checked in the browser can be bypassed.
 * When Supabase is connected, replace signIn/signOut with supabase.auth.signInWithPassword /
 * supabase.auth.signOut and protect the tables with Row Level Security (see supabase/schema.sql).
 */

type Session = { email: string };
type AuthValue = {
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const KEY = 'krish-admin-session';
const AuthContext = createContext<AuthValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);

  const signIn = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 450));
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    const next = { email };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  return <AuthContext.Provider value={{ session, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return ctx;
}
