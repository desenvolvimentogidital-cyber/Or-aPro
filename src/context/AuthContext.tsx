import React, { createContext, useContext, useEffect, useState } from 'react';
import { cloudEnabled, persistSession, readSession, refreshSession, resetPassword, signIn, signOut, signUp, type Session } from '../services/cloud';

interface AuthValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  recover: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<AuthValue | null>(null);
export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider ausente');
  return context;
};
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(cloudEnabled ? readSession() : null);
  const [loading, setLoading] = useState(cloudEnabled && !!readSession());
  const apply = (next: Session | null) => { persistSession(next); setSession(next); };
  useEffect(() => {
    // Remove callback JWTs from the address bar when an authenticated session already exists.
    // Password-recovery links are handled separately by AuthScreen.
    if (session && new URLSearchParams(window.location.hash.slice(1)).has('access_token')) {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.get('type') !== 'recovery') window.history.replaceState({}, '', window.location.pathname + window.location.search);
    }
  }, [session?.user.id]);
  useEffect(() => {
    if (!cloudEnabled || !session) { setLoading(false); return; }
    let active = true;
    const check = async () => {
      try {
        // Refresh proactively to avoid a stale JWT and a failed save.
        if (session.expires_at - Date.now() < 5 * 60_000) {
          const fresh = await refreshSession(session.refresh_token);
          if (active) apply(fresh);
        }
      } catch { if (active) apply(null); }
      finally { if (active) setLoading(false); }
    };
    void check();
    const timer = setInterval(check, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [session?.refresh_token, session?.expires_at]);
  const value: AuthValue = {
    session,
    login: async (email, password) => apply(await signIn(email, password)),
    register: async (email, password) => { const result = await signUp(email, password); if (result) apply(result); return !!result; },
    recover: resetPassword,
    logout: async () => { try { if (session) await signOut(session.access_token); } finally { apply(null); } }
  };
  return <Context.Provider value={value}>{loading ? <div className="min-h-screen grid place-items-center bg-[#0c0e14] text-white">Verificando sessão…</div> : children}</Context.Provider>;
}
