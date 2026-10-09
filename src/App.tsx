import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { AuthScreen } from './components/auth/AuthScreen';
import { PublicQuoteView } from './components/public/PublicQuoteView';
import { cloudEnabled } from './services/cloud';

function ProtectedWorkspace() {
  const { session } = useAuth();
  if (!session) return <AuthScreen />;
  return <ThemeProvider key={session.user.id}><AppProvider key={session.user.id}><AppLayout /></AppProvider></ThemeProvider>;
}

export default function App() {
  // Fail closed in development AND production: real accounts require a real configured database.
  if (!cloudEnabled) return <main className="min-h-screen px-4 py-12 bg-[#0c0e14] text-slate-100 grid place-items-center">
    <section className="max-w-xl rounded-2xl border border-amber-500/30 bg-[#161b26] p-7 space-y-4">
      <h1 className="text-2xl font-bold">OrçaPro — conexão necessária</h1>
      <p>Para utilizar o sistema sem dados simulados, configure um projeto Supabase real e execute o banco de dados do arquivo <code>supabase/schema.sql</code>.</p>
      <p className="text-sm text-slate-300">Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env.local</code> e reinicie o aplicativo. Nenhum cadastro fictício será carregado.</p>
    </section>
  </main>;
  const proposal = new URLSearchParams(window.location.search).get('proposta');
  if (proposal) return <PublicQuoteView token={proposal} />;
  return <AuthProvider><ProtectedWorkspace /></AuthProvider>;
}
