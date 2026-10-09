import React, { useState } from 'react';
import { ArrowLeft, Check, Palette, RefreshCw } from 'lucide-react';
import { useTheme, THEME_PRESETS } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

// This is a user preference screen, not a privileged or multi-tenant administrator panel.
export function AdminPanelView() {
  const { theme, updateTheme, applyPreset, resetTheme } = useTheme();
  const { setActiveView } = useApp();
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [brandName, setBrandName] = useState(theme.brandName);
  const [brandTagline, setBrandTagline] = useState(theme.brandTagline);
  const [brandLogo, setBrandLogo] = useState(theme.brandLogo);
  const [saved, setSaved] = useState(false);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^#[0-9a-f]{6}$/i.test(primaryColor)) return;
    updateTheme({ primaryColor, primaryHover: primaryColor, brandName: brandName.trim() || 'OrçaPro', brandTagline, brandLogo });
    setSaved(true);
  };
  return <div className="space-y-4 pb-20">
    <button onClick={() => setActiveView('dashboard')} className="flex gap-2 items-center text-sm text-slate-300"><ArrowLeft className="w-4 h-4" /> Voltar</button>
    <section className="p-5 rounded-2xl bg-[#141822] border border-white/10 space-y-2">
      <h1 className="font-bold text-lg flex gap-2 items-center"><Palette className="w-5 h-5" /> Aparência do aplicativo</h1>
      <p className="text-xs text-slate-400">As alterações visuais são salvas somente neste navegador para a conta autenticada. Não são configurações globais e não gerenciam outros usuários ou assinaturas.</p>
    </section>
    <section className="p-4 rounded-2xl bg-[#141822] border border-white/10 space-y-3">
      <h2 className="text-sm font-bold">Paletas</h2>
      <div className="grid grid-cols-2 gap-2">{THEME_PRESETS.map(p => <button key={p.id} type="button" onClick={() => { applyPreset(p.id); setPrimaryColor(p.primary); setSaved(false); }} className="rounded-xl border border-white/10 bg-[#1b202c] p-3 text-xs text-left flex gap-2 items-center"><span className="h-5 w-5 rounded-full shrink-0" style={{background:p.primaryGradient}} />{p.name}</button>)}</div>
    </section>
    <form onSubmit={save} className="p-4 rounded-2xl bg-[#141822] border border-white/10 space-y-3">
      <h2 className="text-sm font-bold">Personalização local</h2>
      <label className="block text-xs text-slate-300">Cor primária <input type="color" value={/^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : '#ff6b00'} onChange={e=>setPrimaryColor(e.target.value)} className="block w-14 h-10 mt-1" /></label>
      <label className="block text-xs text-slate-300">Nome exibido<input value={brandName} onChange={e=>setBrandName(e.target.value)} className="block w-full bg-[#0c0e14] border border-white/20 rounded-xl p-3 mt-1 text-white" /></label>
      <label className="block text-xs text-slate-300">Subtítulo<input value={brandTagline} onChange={e=>setBrandTagline(e.target.value)} className="block w-full bg-[#0c0e14] border border-white/20 rounded-xl p-3 mt-1 text-white" /></label>
      <label className="block text-xs text-slate-300">Símbolo<input value={brandLogo} onChange={e=>setBrandLogo(e.target.value)} className="block w-full bg-[#0c0e14] border border-white/20 rounded-xl p-3 mt-1 text-white" /></label>
      <div className="flex gap-3 items-center"><button type="submit" className="bg-orange-600 rounded-xl p-3 text-sm font-bold">Salvar neste navegador</button><button type="button" onClick={() => { resetTheme(); setSaved(false); }} className="flex gap-2 items-center text-xs text-slate-300"><RefreshCw className="w-4 h-4"/> Restaurar padrão</button></div>
      {saved && <p role="status" className="flex items-center text-xs text-emerald-400 gap-2"><Check className="w-4 h-4" /> Preferências atualizadas neste navegador.</p>}
    </form>
  </div>;
}
