import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { setRecoveredPassword } from '../../services/cloud';
export function AuthScreen() {
  const { login, register, recover } = useAuth();
  const [recoveryToken] = useState(() => { const hash = new URLSearchParams(window.location.hash.replace(/^#/, '')); return hash.get('type') === 'recovery' ? hash.get('access_token') : null; });
  const [mode, setMode] = useState<'login' | 'register' | 'recover' | 'set-password'>(recoveryToken ? 'set-password' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage(''); setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      if (mode === 'register') {
        const loggedIn = await register(email.trim(), password);
        if (!loggedIn) setMessage('Cadastro solicitado. Verifique seu e-mail se a confirmação estiver habilitada no Supabase.');
      }
      if (mode === 'recover') { await recover(email.trim()); setMessage('Se o e-mail existir, você receberá instruções de recuperação.'); }
      if (mode === 'set-password' && recoveryToken) { await setRecoveredPassword(recoveryToken, password); window.history.replaceState({}, '', window.location.pathname); setMode('login'); setPassword(''); setMessage('Senha atualizada. Entre com sua nova senha.'); }
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Erro ao autenticar.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-[#080d17] px-4 py-10 flex items-center justify-center text-white">
    <div className="w-full max-w-md rounded-3xl bg-[#141822] border border-white/10 p-6 sm:p-8 space-y-5 shadow-2xl">
      <div><div className="text-orange-400 text-2xl font-black">◈ OrçaPro</div><p className="mt-2 text-sm text-slate-400">Seus orçamentos e clientes com acesso protegido.</p></div>
      <h1 className="text-xl font-bold">{mode === 'login' ? 'Entrar na conta' : mode === 'register' ? 'Criar conta' : mode === 'set-password' ? 'Definir nova senha' : 'Recuperar acesso'}</h1>
      <form onSubmit={submit} className="space-y-4">
        {mode !== 'set-password' && <label className="block text-sm">E-mail<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl bg-[#0c0e14] border border-white/20 px-3 py-3 outline-orange-400" /></label>}
        {mode !== 'recover' && <label className="block text-sm">Senha<input required type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl bg-[#0c0e14] border border-white/20 px-3 py-3 outline-orange-400" /></label>}
        {message && <p role="status" className="text-sm rounded-xl p-3 bg-white/10">{message}</p>}
        <button disabled={busy} type="submit" className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 font-bold disabled:opacity-50">{busy ? 'Processando…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'set-password' ? 'Salvar nova senha' : 'Enviar instruções'}</button>
      </form>
      <div className="text-sm text-slate-400 flex flex-wrap gap-3">
        {mode !== 'login' && mode !== 'set-password' && <button type="button" onClick={() => { setMode('login'); setMessage(''); }} className="underline">Voltar ao login</button>}
        {mode !== 'register' && mode !== 'set-password' && <button type="button" onClick={() => { setMode('register'); setMessage(''); }} className="underline">Criar conta</button>}
        {mode !== 'recover' && mode !== 'set-password' && <button type="button" onClick={() => { setMode('recover'); setMessage(''); }} className="underline">Esqueci minha senha</button>}
      </div>
    </div>
  </main>;
}
