import React from 'react';
import { useApp, AppView } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  X,
  FileText,
  PlusCircle,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  Users,
  Wrench,
  Boxes,
  Briefcase,
  DollarSign,
  Calculator,
  Building2,
  LayoutTemplate,
  BarChart3,
  Settings,
  ShieldCheck,
  ChevronRight,
  Download, CalendarDays
} from 'lucide-react';
import { exportQuotesToCSV, exportFinancialReportToCSV } from '../../utils/csvExport';

export const MoreMenuDrawer: React.FC = () => {
  const {
    isMenuOpen,
    setIsMenuOpen,
    setActiveView,
    setQuoteStatusFilter,
    quotes,
    expenses
  } = useApp();

  const { theme } = useTheme();

  if (!isMenuOpen) return null;

  const handleNav = (view: AppView, quoteFilter?: string) => {
    if (quoteFilter) {
      setQuoteStatusFilter(quoteFilter);
    }
    setActiveView(view);
    setIsMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-sm h-full bg-[#0e1117] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#141822]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-md ring-2 ring-white/10"
              style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
            >
              {theme.brandLogo || '⚡'}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">{theme.brandName}</h2>
              <p className="text-[11px] text-slate-400">Navegação Completa</p>
            </div>
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable menu categories */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2"><h3 className="px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Gestão integrada</h3>
            <button onClick={()=>handleNav('obras')} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/10">🏗 Obras e execução</button>
            <button onClick={()=>handleNav('cronograma')} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/10">📅 Cronograma SINAPI</button>
            <button onClick={()=>handleNav('financeiro')} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/10">💳 Recebimentos e despesas</button>
          </div>
          {/* 1. Orçamentos */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2 flex items-center justify-between">
              <span>Orçamentos</span>
              <span className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded">
                {quotes.length} total
              </span>
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('novo-orcamento')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-medium text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <PlusCircle className="w-4 h-4" style={{ color: theme.primaryColor }} />
                  <span>Novo orçamento</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-transform group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={() => handleNav('orcamentos', 'todos')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span>Todos os orçamentos</span>
                </div>
                <span className="text-xs text-slate-500">{quotes.length}</span>
              </button>

              <button
                onClick={() => handleNav('orcamentos', 'rascunho')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Rascunhos</span>
                </div>
                <span className="text-xs text-slate-500">
                  {quotes.filter(q => q.status === 'rascunho').length}
                </span>
              </button>

              <button
                onClick={() => handleNav('orcamentos', 'enviado')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Enviados</span>
                </div>
                <span className="text-xs text-amber-400/80">
                  {quotes.filter(q => q.status === 'enviado').length}
                </span>
              </button>

              <button
                onClick={() => handleNav('orcamentos', 'aprovado')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Aprovados</span>
                </div>
                <span className="text-xs text-emerald-400/80">
                  {quotes.filter(q => q.status === 'aprovado').length}
                </span>
              </button>

              <button
                onClick={() => handleNav('orcamentos', 'recusado')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>Recusados</span>
                </div>
                <span className="text-xs text-rose-400/80">
                  {quotes.filter(q => q.status === 'recusado').length}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">Planejamento de obras</h3>
            <button type="button" onClick={() => handleNav('cronograma')} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5">
              <span className="flex items-center gap-3"><CalendarDays className="w-4 h-4 text-orange-400"/> Cronograma SINAPI</span>
              <ChevronRight className="w-4 h-4 text-slate-500"/>
            </button>
          </div>
          {/* 2. Cadastros */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Cadastros
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('clientes')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>Clientes</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => handleNav('servicos')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-4 h-4 text-slate-400" />
                  <span>Serviços</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => handleNav('materiais')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Boxes className="w-4 h-4 text-slate-400" />
                  <span>Materiais</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => handleNav('mao-de-obra')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span>Mão de Obra</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>
            </div>
          </div>

          {/* 3. Financeiro */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Financeiro
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('custos-mensais')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Custos Mensais</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => handleNav('formacao-preco')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Calculator className="w-4 h-4" style={{ color: theme.primaryColor }} />
                  <span>Formação de Preço & Markup</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>
            </div>
          </div>

          {/* 4. Empresa & Documentos */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Empresa & Modelos
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('empresa')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>Minha Empresa & Pix</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => handleNav('modelos')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <LayoutTemplate className="w-4 h-4 text-slate-400" />
                  <span>Modelos de Orçamento</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>
            </div>
          </div>

          {/* 5. Relatórios & Exportação */}
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
              Relatórios & Exportações
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('relatorios')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <span>Estatísticas & Gráficos</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>

              <button
                onClick={() => exportQuotesToCSV(quotes)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Orçamentos (CSV)</span>
                </div>
                <span className="text-[11px] text-slate-500">CSV</span>
              </button>

              <button
                onClick={() => exportFinancialReportToCSV(quotes, expenses)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Financeiro (CSV)</span>
                </div>
                <span className="text-[11px] text-slate-500">CSV</span>
              </button>
            </div>
          </div>

          {/* 6. Appearance preferences for this browser only */}
          <div className="pt-2 border-t border-white/10">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[#1c2230] to-[#121620] border border-white/10 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white">
                  Preferências locais
                </span>
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Aparência do aplicativo</h4>
              <p className="text-[11px] text-slate-400 leading-snug mb-3">
                Personalize cores e identidade visual apenas neste navegador. Não gerencia contas nem assinaturas.
              </p>
              <button
                onClick={() => handleNav('admin')}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2 shadow-md active:scale-95"
                style={{
                  background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
                  boxShadow: `0 4px 14px -2px ${theme.primaryColor}66`
                }}
              >
                <Settings className="w-3.5 h-3.5" />
                Personalizar aparência
              </button>
            </div>
          </div>
        </div>

        {/* Footer version */}
        <div className="p-3 border-t border-white/5 text-center bg-[#0d1016]">
          <span className="text-[11px] text-slate-500 font-mono">
            {theme.brandName} v2.2 • Operação real
          </span>
        </div>
      </div>
    </div>
  );
};
