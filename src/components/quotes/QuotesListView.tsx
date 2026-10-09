import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Search, Plus, Filter, FileText, ChevronRight, CheckCircle2, Clock, Send, XCircle, Copy, Trash2, Eye, CalendarDays } from 'lucide-react';
import { formatCurrency, formatDate, getStatusBadge } from '../../utils/formatters';
import { Quote, QuoteStatus } from '../../types';
import type { WorkSchedule } from '../../types/schedule';
import { newId } from '../../utils/quoteMath';

export const QuotesListView: React.FC = () => {
  const {
    quotes,
    setActiveView,
    setActiveQuoteForPreview,
    changeQuoteStatus,
    duplicateQuote,
    deleteQuote,
    schedules,addSchedule,setSelectedScheduleId,
    quoteStatusFilter,
    setQuoteStatusFilter
  } = useApp();

  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMenuQuoteId, setActionMenuQuoteId] = useState<string | null>(null);

  const planQuote=(quote:Quote)=>{
    const existing=schedules.find(s=>s.quoteId===quote.id);
    if(existing) setSelectedScheduleId(existing.id);
    else {
      const now=new Date();
      const local=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
      const schedule:WorkSchedule={
        id:newId('cron'),title:`Cronograma — orçamento ${quote.number} — ${quote.clientName}`,
        quoteId:quote.id,startDate:local,hoursPerDay:8,efficiency:1,tasks:[],
        createdAt:now.toISOString(),updatedAt:now.toISOString()
      };
      addSchedule(schedule);setSelectedScheduleId(schedule.id);
    }
    setActiveView('cronograma');
  };

  // Tabs count
  const allCount = quotes.length;
  const sentCount = quotes.filter(q => q.status === 'enviado').length;
  const approvedCount = quotes.filter(q => q.status === 'aprovado').length;
  const draftCount = quotes.filter(q => q.status === 'rascunho').length;
  const rejectedCount = quotes.filter(q => q.status === 'recusado').length;

  const filteredQuotes = quotes.filter(q => {
    // Status filter
    if (quoteStatusFilter !== 'todos' && q.status !== quoteStatusFilter) {
      return false;
    }
    // Search query
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        q.number.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term) ||
        q.clientPhone.includes(term)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold text-white tracking-tight">Orçamentos</h1>
        <button
          onClick={() => setActiveView('novo-orcamento')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all"
          style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
          title="Novo Orçamento"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Search Input & Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar orçamentos..."
            className="w-full bg-[#141822] text-sm text-white placeholder-slate-500 pl-10 pr-4 py-2.5 rounded-2xl border border-white/5 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>
        <button
          onClick={() => setQuoteStatusFilter(quoteStatusFilter === 'todos' ? 'aprovado' : 'todos')}
          className="p-2.5 rounded-2xl bg-[#141822] border border-white/5 text-slate-400 hover:text-white transition-colors"
          title="Filtro rápido"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs (Referência visual #5: Todos 18, Enviados 6, Aprovados 7, Rascunhos 5) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
        <button
          onClick={() => setQuoteStatusFilter('todos')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            quoteStatusFilter === 'todos'
              ? 'text-white shadow-sm'
              : 'bg-[#141822] text-slate-400 hover:text-white'
          }`}
          style={quoteStatusFilter === 'todos' ? { background: theme.primaryGradient } : {}}
        >
          Todos {allCount}
        </button>

        <button
          onClick={() => setQuoteStatusFilter('enviado')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            quoteStatusFilter === 'enviado'
              ? 'text-white shadow-sm'
              : 'bg-[#141822] text-slate-400 hover:text-white'
          }`}
          style={quoteStatusFilter === 'enviado' ? { background: theme.primaryGradient } : {}}
        >
          Enviados {sentCount}
        </button>

        <button
          onClick={() => setQuoteStatusFilter('aprovado')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            quoteStatusFilter === 'aprovado'
              ? 'text-white shadow-sm'
              : 'bg-[#141822] text-slate-400 hover:text-white'
          }`}
          style={quoteStatusFilter === 'aprovado' ? { background: theme.primaryGradient } : {}}
        >
          Aprovados {approvedCount}
        </button>

        <button
          onClick={() => setQuoteStatusFilter('rascunho')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
            quoteStatusFilter === 'rascunho'
              ? 'text-white shadow-sm'
              : 'bg-[#141822] text-slate-400 hover:text-white'
          }`}
          style={quoteStatusFilter === 'rascunho' ? { background: theme.primaryGradient } : {}}
        >
          Rascunhos {draftCount}
        </button>

        {rejectedCount > 0 && (
          <button
            onClick={() => setQuoteStatusFilter('recusado')}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              quoteStatusFilter === 'recusado'
                ? 'text-white shadow-sm'
                : 'bg-[#141822] text-slate-400 hover:text-white'
            }`}
            style={quoteStatusFilter === 'recusado' ? { background: theme.primaryGradient } : {}}
          >
            Recusados {rejectedCount}
          </button>
        )}
      </div>

      {/* Quote Cards List (Referência visual #5) */}
      <div className="space-y-2.5">
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-12 bg-[#141822] rounded-2xl border border-white/5 p-6">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Nenhum orçamento encontrado</p>
            <button
              onClick={() => setActiveView('novo-orcamento')}
              className="mt-3 text-xs font-semibold px-4 py-2 rounded-xl text-white inline-block shadow-md transition-all active:scale-95"
              style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
            >
              + Criar Novo Orçamento
            </button>
          </div>
        ) : (
          filteredQuotes.map(quote => {
            const badge = getStatusBadge(quote.status);

            return (
              <div
                key={quote.id}
                className="relative p-3.5 rounded-2xl bg-[#141822] border border-white/5 hover:border-white/10 transition-all group"
              >
                <div
                  onClick={() => setActiveQuoteForPreview(quote)}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">
                          Orçamento {quote.number}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{quote.clientName}</p>
                      <span className={`inline-block text-[10px] font-semibold mt-1 ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <div className="text-sm font-black text-white">
                      {formatCurrency(quote.total)}
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {formatDate(quote.date)}
                    </span>
                  </div>
                </div>

                {/* Quick actions drawer under card */}
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveQuoteForPreview(quote)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center gap-1 text-[11px]"
                    >
                      <Eye className="w-3 h-3" />
                      Visualizar
                    </button>
                    <button
                      type="button"
                      onClick={() => planQuote(quote)}
                      disabled={!quote.items.length}
                      title={quote.items.length?'Abrir ou criar cronograma vinculado a este orçamento':'Adicione itens antes de planejar'}
                      className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-200 hover:bg-orange-500/20 disabled:opacity-40 flex items-center gap-1 text-[11px]"
                    >
                      <CalendarDays className="w-3 h-3" />
                      Planejar obra
                    </button>
                    <button
                      onClick={() => duplicateQuote(quote.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 flex items-center gap-1 text-[11px]"
                      title="Duplicar"
                    >
                      <Copy className="w-3 h-3" />
                      Duplicar
                    </button>
                  </div>

                  {/* Status switcher */}
                  <div className="flex items-center gap-1">
                    {quote.status !== 'aprovado' && (
                      <button
                        onClick={() => { if (window.confirm('Registrar aprovação MANUAL? Não substitui a resposta do cliente.')) changeQuoteStatus(quote.id, 'aprovado'); }}
                        className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                        title="Marcar como Aprovado"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {quote.status !== 'enviado' && (
                      <button
                        onClick={() => changeQuoteStatus(quote.id, 'enviado')}
                        className="p-1 text-amber-400 hover:bg-amber-500/10 rounded"
                        title="Marcar como Enviado"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {quote.status !== 'recusado' && (
                      <button
                        onClick={() => changeQuoteStatus(quote.id, 'recusado')}
                        className="p-1 text-rose-400 hover:bg-rose-500/10 rounded"
                        title="Marcar como Recusado"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => { if (window.confirm('Excluir este orçamento? Esta ação pode ser irreversível.')) deleteQuote(quote.id); }}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
