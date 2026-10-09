import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Send,
  Clock,
  DollarSign
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { approvedRevenue, monthlyApprovedTotals, dateKey } from '../../utils/quoteMath';
import { SparklineRevenue, DonutStatusChart } from '../common/Charts';
import { exportQuotesToCSV, exportFinancialReportToCSV } from '../../utils/csvExport';

export const ReportsView: React.FC = () => {
  const { quotes, expenses, setActiveView } = useApp();
  const { theme } = useTheme();

  const [timeRange, setTimeRange] = useState<'este-mes' | '3-meses' | 'ano'>('este-mes');

  const now = new Date();
  const start = timeRange === 'este-mes' ? new Date(now.getFullYear(), now.getMonth(), 1) :
    timeRange === '3-meses' ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : new Date(now.getFullYear(), 0, 1);
  const end = timeRange === 'ano' ? new Date(now.getFullYear() + 1, 0, 1) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const filteredQuotes = quotes.filter(q => q.date >= dateKey(start) && q.date < dateKey(end));
  const totalCount = filteredQuotes.length;
  const approvedQuotes = filteredQuotes.filter(q => q.status === 'aprovado');
  const approvedCount = approvedQuotes.length;
  const sentQuotes = filteredQuotes.filter(q => q.status === 'enviado');
  const sentCount = sentQuotes.length;
  const draftQuotes = filteredQuotes.filter(q => q.status === 'rascunho');
  const draftCount = draftQuotes.length;
  const totalRevenue = approvedRevenue(quotes, start, end);
  const revenueHistory = monthlyApprovedTotals(quotes);
  const approvalRate = totalCount > 0 ? ((approvedCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => setActiveView('dashboard')}
          className="p-1.5 rounded-xl bg-[#141822] text-slate-400 hover:text-white border border-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-white tracking-tight">Estatísticas</h1>
        
        {/* Time period filter */}
        <select
          value={timeRange}
          onChange={e => setTimeRange(e.target.value as any)}
          className="bg-[#141822] text-xs font-semibold text-white px-2.5 py-1.5 rounded-xl border border-white/10 focus:outline-none"
        >
          <option value="este-mes">Este mês</option>
          <option value="3-meses">Últimos 3 meses</option>
          <option value="ano">Ano atual</option>
        </select>
      </div>

      {/* Main Revenue Card (Referência visual #9 top card) */}
      <div className="relative overflow-hidden rounded-2xl bg-[#141822] border border-white/5 p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium tracking-wide">Valor de propostas aprovadas</span>
            <div className="text-2xl font-black text-white mt-0.5 tracking-tight font-mono">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-400 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Propostas aprovadas no período (não necessariamente recebidas)</span>
            </div>
          </div>

          <div className="w-36 h-14 -mr-1">
            <SparklineRevenue height={52} width={140} values={revenueHistory} />
          </div>
        </div>
      </div>

      {/* 3 Metric Cards (Referência visual #9 row) */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-[#141822] border border-white/5 p-3 text-center">
          <span className="text-[11px] text-slate-400 font-medium block">Orçamentos</span>
          <span className="text-lg font-bold text-white block mt-0.5">{totalCount}</span>
          <span className="text-[10px] text-slate-500 font-medium">Total</span>
        </div>

        <div className="rounded-2xl bg-[#141822] border border-white/5 p-3 text-center">
          <span className="text-[11px] text-slate-400 font-medium block">Aprovados</span>
          <span className="text-lg font-bold text-emerald-400 block mt-0.5">{approvedCount}</span>
          <span className="text-[10px] text-emerald-400/80 font-medium">{approvalRate}%</span>
        </div>

        <div className="rounded-2xl bg-[#141822] border border-white/5 p-3 text-center">
          <span className="text-[11px] text-slate-400 font-medium block">Taxa Aprovação</span>
          <span className="text-lg font-bold text-white block mt-0.5">{approvalRate}%</span>
          <span className="text-[10px] text-slate-500 font-medium">Baseado nos orçamentos</span>
        </div>
      </div>

      {/* Donut Chart: Por Status (Referência visual #9 doughnut chart) */}
      <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3">
        <h3 className="text-xs font-bold text-white">Por Status</h3>

        <div className="flex items-center justify-around gap-4 pt-1">
          {/* Doughnut Chart SVG */}
          <DonutStatusChart
            approvedCount={approvedCount}
            sentCount={sentCount}
            draftCount={draftCount}
            size={120}
          />

          {/* Legend Table (Referência visual #9 right column) */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Aprovados</span>
              </div>
              <span className="font-bold text-white font-mono">
                {approvedCount} ({totalCount > 0 ? ((approvedCount / totalCount) * 100).toFixed(1) : 0}%)
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: theme.primaryColor }}
                />
                <span className="text-slate-300">Enviados</span>
              </div>
              <span className="font-bold text-white font-mono">
                {sentCount} ({totalCount > 0 ? ((sentCount / totalCount) * 100).toFixed(1) : 0}%)
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-slate-300">Rascunhos</span>
              </div>
              <span className="font-bold text-white font-mono">
                {draftCount} ({totalCount > 0 ? ((draftCount / totalCount) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Export Options (Prompt requirement!) */}
      <div className="p-4 rounded-2xl bg-[#141822] border border-white/5 space-y-3">
        <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Exportar Dados em Planilha (CSV)</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Baixe os dados em CSV, que pode ser aberto no Excel ou no Google Planilhas.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => exportFinancialReportToCSV(quotes, expenses)}
            className="py-2.5 px-3 rounded-xl bg-[#1b202c] hover:bg-[#242b3a] text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Relatório Financeiro</span>
          </button>

          <button
            onClick={() => exportQuotesToCSV(quotes)}
            className="py-2.5 px-3 rounded-xl bg-[#1b202c] hover:bg-[#242b3a] text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Orçamentos (CSV)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
