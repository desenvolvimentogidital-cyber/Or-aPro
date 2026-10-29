import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { AuthScreen } from './components/auth/AuthScreen';
import { PublicQuoteView } from './components/public/PublicQuoteView';
import { cloudEnabled } from './services/cloud';

class AppCrashBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('Falha ao abrir o OrçaPro:', error); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main role="alert" className="min-h-[100dvh] grid place-items-center bg-slate-100 p-6 text-slate-900">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-xl font-bold">O OrçaPro encontrou um problema ao abrir</h1>
          <p className="mt-3 text-sm text-slate-600">Seus orçamentos e cadastros não foram apagados. Tente abrir o aplicativo novamente.</p>
          <button type="button" className="mt-5 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white" onClick={() => window.location.reload()}>Reabrir OrçaPro</button>
        </section>
      </main>
    );
  }
}

function ProtectedWorkspace() {
  const { session } = useAuth();
  if (!session) return <AuthScreen />;
  return <ThemeProvider key={session.user.id}><AppProvider key={session.user.id}><AppLayout /></AppProvider></ThemeProvider>;
}

function Application() {
  // Fail closed in development AND production: real accounts require a real configured database.
  if (!cloudEnabled) return <main className="min-h-[100dvh] px-4 py-12 bg-slate-100 text-slate-900 grid place-items-center">
    <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-7 space-y-4 shadow-sm">
      <h1 className="text-2xl font-bold">OrçaPro — conexão necessária</h1>
      <p>Para acessar seus dados com segurança, é necessário configurar a conexão Supabase na publicação do OrçaPro. Verifique as variáveis de ambiente na Vercel e a estrutura do banco definida em <code>supabase/schema.sql</code>.</p>
      <p className="text-sm text-slate-300">Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> na Vercel (ou em <code>.env.local</code>, no computador), e publique uma nova versão. Os dados existentes não serão apagados.</p>
    </section>
  </main>;
  const proposal = new URLSearchParams(window.location.search).get('proposta');
  if (proposal) return <PublicQuoteView token={proposal} />;
  return <AuthProvider><ProtectedWorkspace /></AuthProvider>;
}

export default function App() {
  return <AppCrashBoundary><Application /></AppCrashBoundary>;
}
