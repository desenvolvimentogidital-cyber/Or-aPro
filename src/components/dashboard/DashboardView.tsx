import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Bell, Plus, FileText, ArrowRight, TrendingUp, TrendingDown, Clock3, BadgeCheck, BarChart3, AlertTriangle, CircleHelp, Send, WalletCards } from 'lucide-react';
import { formatCurrency, getStatusBadge } from '../../utils/formatters';
import { DonutStatusChart } from '../common/Charts';
import { dashboardMonthlySeries, dashboardSummary, recentlyChangedQuotes, type DashboardPeriod } from '../../utils/dashboardMetrics';
import { financeMetrics } from '../../utils/financeMetrics';

const periodOptions: {key:DashboardPeriod;label:string}[] = [
  {key:'mes',label:'Este mês'}, {key:'trimestre',label:'3 meses'}, {key:'ano',label:'Este ano'}, {key:'tudo',label:'Tudo'}
];

export const DashboardView: React.FC = () => {
  const { quotes, financeEntries, schedules, ready, syncStatus, setActiveView, setActiveQuoteForPreview, setIsNotificationsOpen, unreadNotificationsCount, setQuoteStatusFilter } = useApp();
  const { theme } = useTheme();
  const [period,setPeriod] = useState<DashboardPeriod>('mes');
  const metrics = useMemo(() => dashboardSummary(quotes, period), [quotes, period]);
  const finance = useMemo(()=>financeMetrics(financeEntries,quotes),[financeEntries,quotes]);
  const trends = useMemo(() => dashboardMonthlySeries(quotes, period === 'ano' || period === 'tudo' ? 12 : 6), [quotes, period]);
  const recents = useMemo(() => recentlyChangedQuotes(quotes, 5), [quotes]);
  const maximum = Math.max(1, ...trends.map(m => Math.max(m.issued, m.approved, m.awaiting)));
  const gotoQuotes = (filter:string) => { setQuoteStatusFilter(filter); setActiveView('orcamentos'); };
  const metricCard = (label:string,value:string,description:string, icon:React.ReactNode, action?:()=>void, tone='text-white') => (
    <button type="button" onClick={action} disabled={!action} className="min-w-0 rounded-2xl border border-white/10 bg-[#141822] p-3.5 text-left transition hover:border-white/20 disabled:cursor-default sm:p-4">
      <div className="flex items-center justify-between gap-2 text-slate-400"><span className="text-[11px] font-medium sm:text-xs">{label}</span>{icon}</div>
      <div className={`mt-2 break-words text-lg font-bold tracking-tight sm:text-xl ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-500 sm:text-xs">{description}</div>
    </button>
  );

  return <div className="space-y-4 pb-24 animate-in fade-in duration-200">
    <div className="flex items-start justify-between gap-3 pt-1">
      <div><h1 className="text-xl font-bold tracking-tight text-white">Visão geral</h1><p className="mt-1 text-xs text-slate-400">Seus orçamentos e resultados, sem valores de demonstração.</p></div>
      <button onClick={() => setIsNotificationsOpen(true)} className="relative rounded-full border border-white/10 bg-[#161a22] p-2.5 text-slate-300 hover:bg-[#1f2533]" title="Notificações" aria-label="Abrir notificações">
        <Bell className="h-4 w-4"/>{unreadNotificationsCount > 0 && <span className="absolute right-1 top-1 min-w-3 rounded-full bg-orange-500 px-0.5 text-center text-[9px] font-bold text-white">{unreadNotificationsCount>9?'9+':unreadNotificationsCount}</span>}
      </button>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/5 bg-[#141822] p-2.5 sm:p-3">
      <span className="px-1 text-[11px] font-semibold text-slate-300">Período dos indicadores</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Selecionar período">
        {periodOptions.map(option => <button type="button" key={option.key} onClick={() => setPeriod(option.key)} aria-pressed={period===option.key} className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${period===option.key?'text-white':'text-slate-400 hover:text-white hover:bg-white/5'}`} style={period===option.key?{background:theme.primaryColor}:{}}>{option.label}</button>)}
      </div>
    </div>

    {syncStatus === 'error' && <div role="alert" className="rounded-xl border border-rose-600/30 bg-rose-500/10 p-3 text-xs text-rose-200">Existe um erro de sincronização. Confira o aviso do aplicativo antes de confiar nos dados mais recentes.</div>}
    {!ready && <div className="rounded-2xl border border-white/10 bg-[#141822] p-5 text-sm text-slate-300">Carregando informações do seu banco de dados…</div>}
    {ready && <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {metricCard('Propostas emitidas',formatCurrency(metrics.issuedValue),`${metrics.issuedCount} enviadas ou decididas no período`,<Send className="h-4 w-4"/>,()=>gotoQuotes('todos'))}
        {metricCard('Aguardando resposta',formatCurrency(metrics.awaitingValue),`${metrics.awaitingCount} orçamento(s) enviados, ainda sem decisão`,<Clock3 className="h-4 w-4 text-amber-400"/>,()=>gotoQuotes('enviado'),'text-amber-400')}
        {metricCard('Valor aprovado',formatCurrency(metrics.approvedValue),`${metrics.approvedCount} aprovação(ões) no período · não é valor recebido`,<BadgeCheck className="h-4 w-4 text-emerald-400"/>,()=>gotoQuotes('aprovado'),'text-emerald-400')}
        {metricCard('Lucro estimado',metrics.profitComplete?formatCurrency(metrics.estimatedProfit):'A conferir',metrics.profitComplete?(metrics.approvedValue>0?`Margem estimada ${(100*metrics.estimatedProfit/metrics.approvedValue).toFixed(1)}% · sem despesas fixas`:'Sem aprovações no período'):'Custos de itens ausentes em '+metrics.incompleteProfitCount+' orçamento(s) aprovado(s)',metrics.estimatedProfit<0?<TrendingDown className="h-4 w-4 text-rose-400"/>:<TrendingUp className="h-4 w-4 text-emerald-400"/>,()=>setActiveView('relatorios'),metrics.profitComplete?(metrics.estimatedProfit<0?'text-rose-400':'text-white'):'text-amber-400')}
        {metricCard('Orçamentos criados',String(metrics.totalQuotes),`${metrics.statuses.rascunho} rascunho(s) no período`,<FileText className="h-4 w-4"/>,()=>gotoQuotes('todos'))}
        {metricCard('Taxa de aprovação',metrics.approvalRate===null?'—':`${metrics.approvalRate.toFixed(1)}%`,'Entre orçamentos com decisão (aprovados ou recusados)',<BarChart3 className="h-4 w-4"/>,()=>setActiveView('relatorios'))}
      </div>

      <section className="space-y-3 rounded-2xl border border-white/10 bg-[#101620] p-4"><div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><WalletCards size={17} className="text-orange-400"/> Financeiro realizado</h2><button onClick={()=>setActiveView('financeiro')} className="text-xs font-semibold text-orange-400 hover:underline">Abrir financeiro →</button></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{metricCard('Recebido',formatCurrency(finance.received),'Registrado como pagamento real',<TrendingUp size={16} className="text-emerald-400"/>,()=>setActiveView('financeiro'))}{metricCard('Despesas pagas',formatCurrency(finance.spent),'Saídas efetivamente lançadas',<TrendingDown size={16} className="text-rose-400"/>,()=>setActiveView('financeiro'))}{metricCard('Saldo de caixa',formatCurrency(finance.cashBalance),'Não representa lucro líquido',<WalletCards size={16}/>,()=>setActiveView('financeiro'))}{metricCard('A receber (aprovados)',formatCurrency(finance.receivable),'Aprovações menos recebimentos vinculados',<Clock3 size={16}/>,()=>setActiveView('financeiro'))}</div>
        <p className="text-[11px] text-slate-400">Esses totais financeiros são históricos de lançamentos registrados, independentes do filtro de data dos orçamentos acima. Sem movimentações registradas, exibem zero e não valores estimados.</p>
      </section>
      <button onClick={()=>setActiveView('obras')} className="w-full rounded-xl border border-orange-500/20 bg-[#141822] px-4 py-3 text-left text-xs text-orange-300 hover:bg-white/5">Obras e medições ({schedules.length} cronograma(s)) →</button>
      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-slate-500"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0"/> Os valores aprovados seguem a data da aprovação registrada; orçamentos antigos sem esse registro usam a data de emissão. Valores emitidos e pendentes seguem a data de emissão. Nenhum valor representa pagamento recebido. Aprovações também podem ser registradas manualmente; consulte o histórico do orçamento para verificar a origem.</p>

      {metrics.incompleteProfitCount>0 && <div className="flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0"/> O lucro não foi exibido como valor definitivo porque faltam custos em {metrics.incompleteProfitCount} orçamento(s) aprovado(s). Cadastre os custos de cada item para obter uma estimativa confiável.</div>}
      {metrics.invalidAmountCount>0 && <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-200">Há {metrics.invalidAmountCount} orçamento(s) com valores inválidos, excluídos das somas. Revise esses registros.</div>}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
        <section className="rounded-2xl border border-white/10 bg-[#141822] p-4" aria-label="Evolução mensal dos orçamentos">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-bold text-white">Evolução mensal</h2><BarChart3 className="h-4 w-4 text-slate-500"/></div>
          <p className="mb-4 text-[11px] text-slate-400">Últimos {trends.length} meses. Valores agrupados pelo mês de emissão ou aprovação, conforme o indicador.</p>
          {trends.some(t=>t.issued||t.approved||t.awaiting)?<>
            <div className="flex h-40 items-end gap-2 border-b border-white/10 pb-1 sm:gap-3" role="img" aria-label={trends.map(t=>`${t.label}: emitido ${formatCurrency(t.issued)}, aprovado ${formatCurrency(t.approved)}, pendente ${formatCurrency(t.awaiting)}`).join('; ')}>
              {trends.map(t=><div key={t.month} className="flex h-full min-w-0 flex-1 items-end gap-[2px]" title={`${t.month} · Emitidos: ${formatCurrency(t.issued)} · Aprovados: ${formatCurrency(t.approved)} · Pendentes: ${formatCurrency(t.awaiting)}`}>
                <span className="min-w-0 flex-1 rounded-t bg-slate-500/80" style={{height:`${t.issued===0?0:Math.max(2,t.issued/maximum*100)}%`}}/>
                <span className="min-w-0 flex-1 rounded-t bg-emerald-400" style={{height:`${t.approved===0?0:Math.max(2,t.approved/maximum*100)}%`}}/>
                <span className="min-w-0 flex-1 rounded-t bg-amber-400" style={{height:`${t.awaiting===0?0:Math.max(2,t.awaiting/maximum*100)}%`}}/>
              </div>)}
            </div>
            <div className="mt-2 flex gap-2 text-[10px] text-slate-500">{trends.map(t=><span key={t.month} className="min-w-0 flex-1 text-center capitalize">{t.label}</span>)}</div>
          </>:<div className="flex h-36 items-center justify-center text-xs text-slate-500">Ainda não há valores para exibir no gráfico.</div>}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-slate-500"/>Emitidos</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-emerald-400"/>Aprovados</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-amber-400"/>Aguardando</span></div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#141822] p-4" aria-label="Distribuição por situação">
          <h2 className="text-sm font-bold text-white">Situação dos orçamentos</h2>
          <p className="mt-1 text-[11px] text-slate-400">Por data de emissão no período</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5">
            <DonutStatusChart approvedCount={metrics.statuses.aprovado} sentCount={metrics.statuses.enviado} draftCount={metrics.statuses.rascunho} rejectedCount={metrics.statuses.recusado} size={130}/>
            <div className="space-y-2 text-xs">
              {([{name:'Aprovados',count:metrics.statuses.aprovado,cls:'bg-emerald-400',filter:'aprovado'},{name:'Enviados',count:metrics.statuses.enviado,cls:'bg-orange-400',filter:'enviado'},{name:'Rascunhos',count:metrics.statuses.rascunho,cls:'bg-slate-500',filter:'rascunho'},{name:'Recusados',count:metrics.statuses.recusado,cls:'bg-rose-400',filter:'recusado'}]).map(item=><button key={item.filter} onClick={()=>gotoQuotes(item.filter)} className="flex w-full items-center justify-between gap-5 text-slate-300 hover:text-white"><span className="flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${item.cls}`}/>{item.name}</span><strong>{item.count}</strong></button>)}
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-white/5 bg-[#141822] p-3 text-[11px] leading-relaxed text-slate-400"><WalletCards className="mt-0.5 h-4 w-4 shrink-0"/><div><strong className="text-slate-200">Sobre lucro e faturamento:</strong> o lucro mostrado é uma estimativa por orçamento (valor vendido menos custos diretos, deslocamento, adicionais e imposto estimado). Pagamentos e despesas lançados agora são exibidos separadamente no Financeiro. Apenas os valores efetivamente registrados entram no saldo de caixa, que não equivale a lucro líquido contábil.</div></div>

      <button onClick={()=>setActiveView('cronograma')} className="flex w-full items-center justify-between gap-2 rounded-2xl border border-orange-500/20 bg-[#141822] px-4 py-3 text-left hover:border-orange-400/40"><span className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-orange-400"/><span><strong className="block text-xs text-white">Cronograma de execução SINAPI</strong><span className="text-[11px] text-slate-400">Planeje serviços, equipes e prazos com coeficientes importados</span></span></span><ArrowRight className="h-4 w-4 text-orange-400"/></button>

      <button onClick={()=>setActiveView('novo-orcamento')} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90" style={{background:theme.primaryGradient||theme.primaryColor}}><Plus className="h-5 w-5"/> Novo orçamento</button>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1"><h2 className="text-sm font-bold text-white">Atividade recente</h2><button onClick={()=>gotoQuotes('todos')} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{color:theme.primaryColor}}>Ver todos <ArrowRight className="h-3 w-3"/></button></div>
        {recents.length===0?<div className="rounded-2xl border border-white/5 bg-[#141822] px-4 py-8 text-center text-xs text-slate-400">Nenhum orçamento cadastrado. Crie o primeiro para acompanhar seus resultados aqui.</div>:recents.map(quote=>{const badge=getStatusBadge(quote.status);return <button key={quote.id} onClick={()=>setActiveQuoteForPreview(quote)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#141822] p-3.5 text-left hover:border-white/20"><span className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-white/5 p-2.5"><FileText className="h-4 w-4 text-slate-400"/></span><span className="min-w-0"><strong className="block truncate text-xs text-white">Orçamento {quote.number}</strong><span className="block truncate text-[11px] text-slate-400">{quote.clientName}</span></span></span><span className="shrink-0 text-right"><strong className="block text-xs text-white">{formatCurrency(quote.total)}</strong><span className={`text-[10px] ${badge.text}`}>{badge.label}</span></span></button>;})}
      </section>
    </>}
  </div>;
};
