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
      // A stalled connection must not leave the user on an endless dark loading screen.
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12_000);
      try {
        // Refresh proactively to avoid a stale JWT and a failed save.
        if (session.expires_at - Date.now() < 5 * 60_000) {
          const fresh = await refreshSession(session.refresh_token, controller.signal);
          if (active) apply(fresh);
        }
      } catch {
        // Only clear the browser session. No customer records are deleted from Supabase.
        if (active) apply(null);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
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
  return <Context.Provider value={value}>{loading ? (
    <main role="status" className="min-h-[100dvh] grid place-items-center bg-slate-100 px-5 text-slate-900">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-bold">OrçaPro</h1>
        <p className="mt-3 text-sm text-slate-600">Verificando seu acesso com segurança…</p>
      </div>
    </main>
  ) : children}</Context.Provider>;
}
