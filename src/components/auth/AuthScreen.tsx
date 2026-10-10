import React, { useState } from 'react';
import { CalendarDays, Eye, EyeOff, FileText, HardHat, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { setRecoveredPassword } from '../../services/cloud';

type AuthMode = 'login' | 'register' | 'recover' | 'set-password';

export function AuthScreen() {
  const { login, register, recover } = useAuth();
  const [recoveryToken] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return hash.get('type') === 'recovery' ? hash.get('access_token') : null;
  });
  const [mode, setMode] = useState<AuthMode>(recoveryToken ? 'set-password' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setShowPassword(false);
    setMessage('');
    setIsError(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      if (mode === 'register') {
        const loggedIn = await register(email.trim(), password);
        if (!loggedIn) setMessage('Cadastro solicitado. Verifique seu e-mail se a confirmação estiver habilitada no Supabase.');
      }
      if (mode === 'recover') {
        await recover(email.trim());
        setMessage('Se o e-mail existir, você receberá instruções de recuperação.');
      }
      if (mode === 'set-password' && recoveryToken) {
        await setRecoveredPassword(recoveryToken, password);
        window.history.replaceState({}, '', window.location.pathname);
        switchMode('login');
        setMessage('Senha atualizada. Entre com sua nova senha.');
      }
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Não foi possível autenticar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'login' ? 'Bem-vindo de volta'
    : mode === 'register' ? 'Crie sua conta'
    : mode === 'set-password' ? 'Defina sua nova senha' : 'Recupere o acesso';
  const description = mode === 'login' ? 'Acesse seus orçamentos, obras e cronogramas em um só lugar.'
    : mode === 'register' ? 'Comece a organizar orçamentos e obras com sua própria conta.'
    : mode === 'set-password' ? 'Escolha uma senha nova para acessar novamente o OrçaPro.'
    : 'Informe seu e-mail para receber as instruções de recuperação.';

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#080d17] px-3 py-5 text-white sm:px-6 sm:py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#111924] shadow-[0_30px_90px_rgba(0,0,0,.45)] lg:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden min-h-[590px] flex-col justify-between overflow-hidden border-r border-orange-500/10 bg-gradient-to-br from-[#132a3e] via-[#0b1b2b] to-[#0b121d] p-10 lg:flex" aria-label="Recursos do OrçaPro">
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative">
            <div className="mb-14 flex items-center gap-3 text-xl font-black tracking-tight text-white">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-orange-500/40 bg-orange-500/10 text-2xl text-orange-400">◈</span>
              OrçaPro
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-orange-400">Gestão completa de obras</p>
            <h2 className="max-w-sm text-4xl font-black leading-[1.15] tracking-tight">Da proposta à execução, com tudo sob controle.</h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-300">Planeje serviços, dimensione equipes, acompanhe medições e prepare relatórios usando as informações reais da sua obra.</p>
            <div className="mt-10 space-y-4">
              {([
                [FileText, 'Orçamentos organizados', 'Do orçamento ao acompanhamento financeiro.'],
                [CalendarDays, 'Cronograma SINAPI', 'Prazos, equipes e evolução física da obra.'],
                [HardHat, 'Gestão na obra', 'Acesso pelo celular ou pelo computador.'],
              ] as const).map(([Icon, label, detail]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#33526a] bg-[#172c40] text-orange-300"><Icon size={19} aria-hidden="true" /></span>
                  <span><strong className="block text-sm text-white">{label}</strong><small className="text-xs text-slate-400">{detail}</small></span>
                </div>
              ))}
            </div>
          </div>
          <p className="relative mt-8 flex items-center gap-2 text-xs text-slate-400"><ShieldCheck size={17} className="text-orange-300" aria-hidden="true" /> Seu espaço de trabalho, protegido por autenticação.</p>
        </section>

        <section className="min-w-0 px-5 py-8 sm:px-9 sm:py-12 lg:flex lg:flex-col lg:justify-center lg:px-12">
          <div className="mb-7 flex items-center gap-2 text-lg font-black text-orange-400 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-xl">◈</span> OrçaPro
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-orange-400">Sua área de trabalho</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{heading}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode !== 'set-password' && (
              <label htmlFor="orcapro-auth-email" className="block text-sm font-medium text-slate-200">
                E-mail
                <input id="orcapro-auth-email" required type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#0a1019] px-4 py-3.5 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20" />
              </label>
            )}
            {mode !== 'recover' && (
              <div>
                <label htmlFor="orcapro-auth-password" className="block text-sm font-medium text-slate-200">Senha</label>
                <div className="relative mt-2">
                  <input id="orcapro-auth-password" required type={showPassword ? 'text' : 'password'} minLength={8}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Sua senha' : 'Pelo menos 8 caracteres'}
                    className="w-full rounded-xl border border-white/15 bg-[#0a1019] px-4 py-3.5 pr-14 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-1 grid w-12 place-items-center rounded-lg text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400">
                    {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}
            {message && <p role={isError ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm leading-relaxed ${isError ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-orange-500/20 bg-orange-500/10 text-orange-100'}`}>{message}</p>}
            <button disabled={busy} type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-orange-600 px-4 py-3 font-bold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-500 disabled:cursor-wait disabled:opacity-50">
              {busy ? 'Processando…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'set-password' ? 'Salvar nova senha' : 'Enviar instruções'}
            </button>
          </form>

          <nav aria-label="Opções de acesso" className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-300">
            {mode !== 'login' && mode !== 'set-password' && <button type="button" onClick={() => switchMode('login')} className="underline decoration-slate-600 underline-offset-4 hover:text-white">Voltar ao login</button>}
            {mode !== 'register' && mode !== 'set-password' && <button type="button" onClick={() => switchMode('register')} className="font-semibold text-orange-300 underline decoration-orange-500/40 underline-offset-4 hover:text-orange-200">Criar conta</button>}
            {mode !== 'recover' && mode !== 'set-password' && <button type="button" onClick={() => switchMode('recover')} className="underline decoration-slate-600 underline-offset-4 hover:text-white">Esqueci minha senha</button>}
          </nav>
          <p className="mt-9 border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-500">Seus projetos permanecem vinculados à sua conta. A autenticação e a sincronização continuam usando o serviço configurado no OrçaPro.</p>
        </section>
      </div>
    </main>
  );
}
