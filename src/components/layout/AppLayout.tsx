import React from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Home,
  Users,
  Plus,
  FileText,
  Menu,
  Wifi,
  Battery,
  Smartphone,
  Maximize2,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  HardHat,
  Wallet,
  BarChart3,
  Settings
} from 'lucide-react';
import { DashboardView } from '../dashboard/DashboardView';
import { ScheduleView } from '../schedule/ScheduleView';
import { WorksView } from '../works/WorksView';
import { FinancialControlView } from '../finance/FinancialControlView';
import { BackupPanel } from '../backups/BackupPanel';
import { useAuth } from '../../context/AuthContext';
import { ClientsView } from '../clients/ClientsView';
import { QuotesListView } from '../quotes/QuotesListView';
import { QuoteBuilderView } from '../quotes/QuoteBuilderView';
import { CatalogView } from '../catalog/CatalogView';
import { PricingFormationView } from '../finance/PricingFormationView';
import { QuoteModelsView } from '../models/QuoteModelsView';
import { ReportsView } from '../reports/ReportsView';
import { CompanySettingsView } from '../company/CompanySettingsView';
import { AdminPanelView } from '../admin/AdminPanelView';
import { QuotePreviewModal } from '../quotes/QuotePreviewModal';
import { MoreMenuDrawer } from '../menu/MoreMenuDrawer';
import { NotificationsDrawer } from '../notifications/NotificationsDrawer';

export const AppLayout: React.FC = () => {
  const {
    activeView,
    setActiveView,
    activeQuoteForPreview,
    setActiveQuoteForPreview,
    isMenuOpen,
    setIsMenuOpen,
    viewMode,
    setViewMode,
    unreadNotificationsCount,
    setIsNotificationsOpen,
    ready, syncError, syncStatus, retrySync
  } = useApp();
  const { session, logout } = useAuth();

  const { theme } = useTheme();
  const scheduleWide = activeView === 'cronograma' && viewMode === 'responsive';

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'clientes':
        return <ClientsView />;
      case 'orcamentos':
        return <QuotesListView />;
      case 'cronograma':
        return <ScheduleView />;
      case 'obras':
        return <WorksView />;
      case 'financeiro':
        return <FinancialControlView />;
      case 'novo-orcamento':
        return <QuoteBuilderView />;
      case 'servicos':
        return <CatalogView initialType="servico" />;
      case 'materiais':
        return <CatalogView initialType="material" />;
      case 'mao-de-obra':
        return <CatalogView initialType="mao_de_obra" />;
      case 'custos-mensais':
      case 'formacao-preco':
        return <PricingFormationView />;
      case 'modelos':
        return <QuoteModelsView />;
      case 'relatorios':
        return <ReportsView />;
      case 'empresa':
        return <CompanySettingsView />;
      case 'admin':
        return <AdminPanelView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#07090d] text-slate-100 flex flex-col items-center justify-start p-0 sm:py-6 sm:px-4 font-sans select-none antialiased">
      {/* Operational status visible in both mobile and desktop. */}
      <div className={`w-full ${scheduleWide ? 'max-w-[1720px]' : 'max-w-6xl'} px-3 py-2 flex items-center justify-between gap-2 text-[11px] border-b border-white/10 bg-[#141822] sm:rounded-xl sm:mb-2`}>
        <span className={syncStatus === 'error' ? 'text-rose-400' : syncStatus === 'saving' ? 'text-amber-300' : 'text-emerald-300'} role="status">
          {syncStatus === 'error' ? '⚠ Erro de sincronização' : !ready ? '☁ Conectando à conta…' : syncStatus === 'saving' ? '☁ Salvando na nuvem…' : '☁ Dados na nuvem'}
        </span>
        <div className="flex items-center gap-3"><BackupPanel />{session && <button className="text-slate-300 underline" onClick={() => { if (syncStatus !== 'saved' && !window.confirm('Há alterações não sincronizadas. Exporte um backup antes de sair. Deseja continuar?')) return; void logout(); }}>Sair</button>}</div>
      </div>
      {!ready && syncStatus === 'error' && <div role="alert" className="text-rose-200 text-xs px-3 py-2 w-full max-w-6xl">Falha ao carregar dados protegidos. <button className="underline" onClick={() => window.location.reload()}>Recarregar conexão</button></div>}
      {syncError && <div role="alert" className="text-rose-200 text-xs px-3 py-2 bg-rose-950/90 w-full max-w-6xl">{syncError}. Exporte um backup antes de fechar. {ready && <button className="underline ml-2" onClick={() => { void retrySync(); }}>Tentar novamente</button>}</div>}
      {/* Top Device Switcher Toolbar (for desktop preview testing) */}
      <header className={`w-full ${scheduleWide ? 'max-w-[1720px]' : 'max-w-6xl'} hidden sm:flex items-center justify-between mb-3 px-2 text-xs`}>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: theme.primaryColor }}
          />
          <span className="font-bold text-white tracking-wide">{theme.brandName}</span>
          <span className="text-[10px] text-slate-500 font-mono">v2.5</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#141822] p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setViewMode('mobile')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition-all text-[11px] ${
              viewMode === 'mobile'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Visualização em largura de celular"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Celular</span>
          </button>
          <button
            onClick={() => setViewMode('responsive')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition-all text-[11px] ${
              viewMode === 'responsive'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Formato Fluido / Tela Cheia"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fluido</span>
          </button>
        </div>
      </header>

      {/* Main Container: Mobile Frame or Fluid Container */}
      <main
        className={`w-full transition-all duration-300 relative flex flex-col ${
          viewMode === 'mobile'
            ? 'max-w-[420px] min-h-[860px] sm:h-[880px] bg-[#0c0e14] sm:rounded-[42px] sm:border-[8px] sm:border-[#1e232e] sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden'
            : `${scheduleWide ? 'max-w-[1720px]' : 'max-w-6xl'} min-h-screen sm:min-h-[850px] bg-[#0c0e14] sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]`
        }`}
      >
        {/* Navegacao lateral apenas no desktop; o modo celular permanece intacto. */}
        {viewMode === 'responsive' && (
          <aside className="hidden lg:flex lg:col-start-1 lg:row-start-1 min-w-0 flex-col border-r border-white/10 bg-[#121721] p-4" aria-label="Barra lateral do OrçaPro">
            <div className="border-b border-white/10 px-3 pb-5 pt-2">
              <p className="text-xl font-black tracking-tight text-orange-400">◈ OrçaPro</p>
              <p className="mt-1 text-xs text-slate-400">Área de trabalho</p>
            </div>
            <nav aria-label="Navegação desktop" className="mt-4 flex flex-1 flex-col gap-1">
              {([
                ['dashboard', 'Visão geral', Home],
                ['orcamentos', 'Orçamentos', FileText],
                ['novo-orcamento', 'Novo orçamento', Plus],
                ['clientes', 'Clientes', Users],
                ['cronograma', 'Cronograma SINAPI', CalendarDays],
                ['obras', 'Obras', HardHat],
                ['financeiro', 'Financeiro', Wallet],
                ['formacao-preco', 'Formação de preço', BarChart3],
                ['servicos', 'Serviços e catálogo', Sparkles],
                ['relatorios', 'Relatórios', BarChart3],
                ['empresa', 'Minha empresa', Settings],
              ] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveView(id)}
                  aria-current={activeView === id ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400 ${
                    activeView === id ? 'bg-orange-600/20 font-semibold text-orange-200 ring-1 ring-orange-500/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="border-t border-white/10 px-3 pt-4 text-xs text-slate-500">
              <span>Ambiente conectado à sua conta</span>
            </div>
          </aside>
        )}
        {/* Content View with smooth scroll */}
        <div className="flex-1 min-w-0 overflow-y-auto px-4 pt-2 no-scrollbar relative lg:col-start-2 lg:row-start-1 lg:px-7 lg:pt-5">
          {ready ? renderActiveView() : <div role="status" className="p-6 text-center text-sm text-slate-300">Carregando dados protegidos… Se o carregamento falhar, verifique a configuração do banco e faça login novamente.</div>}
        </div>

        {/* BOTTOM NAVIGATION BAR (Referência visual 48471.png: Início | Clientes | (+) | Orçamentos | Mais) */}
        <nav
          aria-label="Navegação Principal"
          className={`w-full bg-[#0e1118]/95 backdrop-blur-md border-t border-white/5 py-2 px-3 items-center justify-around shrink-0 sticky bottom-0 z-30 ${viewMode==='responsive'?'flex lg:hidden':'flex'}`}
        >
          {/* 1. Início */}
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              activeView === 'dashboard'
                ? 'font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={activeView === 'dashboard' ? { color: theme.primaryColor } : {}}
          >
            <Home className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] tracking-tight">Início</span>
          </button>

          {/* 2. Clientes */}
          <button
            onClick={() => setActiveView('clientes')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              activeView === 'clientes'
                ? 'font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={activeView === 'clientes' ? { color: theme.primaryColor } : {}}
          >
            <Users className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] tracking-tight">Clientes</span>
          </button>

          {/* 3. (+) Novo Orçamento Button (Floating prominent round button with glow and gradient) */}
          <button
            onClick={() => setActiveView('novo-orcamento')}
            className="w-13 h-13 -mt-5 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-90 hover:scale-105 ring-4 ring-[#0c0e14]"
            style={{
              background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
              boxShadow: `0 8px 24px -2px ${theme.primaryColor}88`
            }}
            title="Novo Orçamento"
            aria-label="Criar Novo Orçamento"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          {/* 4. Orçamentos */}
          <button
            onClick={() => setActiveView('orcamentos')}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              activeView === 'orcamentos'
                ? 'font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={activeView === 'orcamentos' ? { color: theme.primaryColor } : {}}
          >
            <FileText className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] tracking-tight">Orçamentos</span>
          </button>

          {/* 5. Mais / Menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all ${
              isMenuOpen
                ? 'font-bold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            style={isMenuOpen ? { color: theme.primaryColor } : {}}
          >
            <Menu className="w-5 h-5 stroke-[2.2]" />
            <span className="text-[10px] tracking-tight">Mais</span>
          </button>
        </nav>
      </main>

      {/* Global Modals & Drawers */}
      {activeQuoteForPreview && (
        <QuotePreviewModal
          quote={activeQuoteForPreview}
          onClose={() => setActiveQuoteForPreview(null)}
        />
      )}

      {ready && <MoreMenuDrawer />}
      {ready && <NotificationsDrawer />}
    </div>
  );
};
