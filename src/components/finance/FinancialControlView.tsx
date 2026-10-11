import React, { useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, ReceiptText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { financeMetrics } from '../../utils/financeMetrics';
import {compareWorkFinance,financialWorkQuoteId} from '../../utils/workFinanceComparison';
import { newId } from '../../utils/quoteMath';
import type { FinanceEntry } from '../../types/finance';

const ctrl='w-full rounded-xl border border-white/10 bg-[#0b0e15] px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-orange-400';
const fmt=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const today=()=>new Date().toLocaleDateString('en-CA');
function parseMoney(v:string){
  const sanitized=v.trim().replace(/\s/g,'');
  if(!/^[0-9]+([,.][0-9]{1,2})?$/.test(sanitized))return NaN;
  return Number(sanitized.replace(',','.'));
}
export const FinancialControlView: React.FC=()=>{
  const {financeEntries,addFinanceEntry,deleteFinanceEntry,quotes,schedules,syncStatus}=useApp();
  const [type,setType]=useState<FinanceEntry['type']>('recebimento');
  const [date,setDate]=useState(today);
  const [amount,setAmount]=useState('');
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState('');
  const [quoteId,setQuoteId]=useState('');
  const [scheduleId,setScheduleId]=useState('');
  const [selectedWork,setSelectedWork]=useState('');
  const [error,setError]=useState('');
  const [period,setPeriod]=useState('todos');
  const metrics=useMemo(()=>financeMetrics(financeEntries,quotes),[financeEntries,quotes]);
  const comparison=useMemo(()=>compareWorkFinance(schedules,quotes,financeEntries),
    [schedules,quotes,financeEntries]);
  const workSummary=comparison.projects.find(s=>s.scheduleId===selectedWork);
  const display=useMemo(()=>financeEntries.filter(e=>period==='todos'||e.date.startsWith(period)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[financeEntries,period]);
  const months=[...new Set(financeEntries.map(e=>e.date.slice(0,7)))].filter(s=>/^\d{4}-\d{2}$/.test(s)).sort().reverse();
  const save=(e:React.FormEvent)=>{
    e.preventDefault();
    try {
      const ids=financialWorkQuoteId(scheduleId,quoteId,schedules);
      const entry:FinanceEntry={id:newId('mov'),type,date,amount:parseMoney(amount),
        description:description.trim(),category:category.trim(),
        ...ids,createdAt:new Date().toISOString()};
      addFinanceEntry(entry);
      setAmount('');setDescription('');setCategory('');setQuoteId('');setScheduleId('');
      setError('');
    }
    catch(err){setError(err instanceof Error?err.message:'Falha ao registrar lançamento.');}
  };
  const card=(label:string,value:number,sub:string)=> <div className="rounded-2xl border border-white/10 bg-[#141822] p-4"><p className="text-[11px] text-slate-400">{label}</p><strong className="mt-2 block text-lg font-bold text-white">{fmt(value)}</strong><p className="mt-1 text-[10px] text-slate-500">{sub}</p></div>;
  return <div className="space-y-5 py-5 pb-24">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-orange-500/10 p-3 text-orange-400"><Wallet size={22}/></span><div><h1 className="text-xl font-bold">Controle financeiro real</h1><p className="mt-1 text-xs text-slate-400">Registre pagamentos efetivamente recebidos e despesas realmente pagas. Aprovações não geram recebimentos automaticamente.</p></div></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {card('Recebido',metrics.received,'Somente pagamentos registrados')}
      {card('Despesas pagas',metrics.spent,'Somente saídas registradas')}
      {card('Saldo de caixa',metrics.cashBalance,'Recebido menos pago; não é lucro líquido')}
      {card('A receber de aprovados',metrics.receivable,'Aprovados menos recebimentos vinculados')}
    </div>
    <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">Valores só são reais após registro manual verídico. Saldo de caixa não equivale a lucro contábil: impostos, competência, custos indiretos, inadimplência e valores não lançados podem afetá-lo.</p>
    {metrics.overpaidQuotes>0&&<p role="alert" className="text-amber-300 text-xs">Existem {metrics.overpaidQuotes} orçamento(s) aprovado(s) com recebimentos vinculados acima do total. Confira adiantamentos e possíveis lançamentos repetidos.</p>}
    {metrics.invalidEntries>0&&<p role="alert" className="text-rose-300 text-xs">{metrics.invalidEntries} lançamento(s) inválido(s) ignorado(s) nos totais; exporte backup e revise.</p>}
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-white/10 bg-[#141822] p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Plus size={18} className="text-orange-400"/> Registrar movimentação efetiva</h2>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-400">Movimento<select className={`${ctrl} mt-1`} value={type} onChange={e=>setType(e.target.value as FinanceEntry['type'])}><option value="recebimento">Recebimento</option><option value="despesa">Despesa paga</option></select></label><label className="text-xs text-slate-400">Data do movimento<input className={`${ctrl} mt-1`} type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label></div>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-400">Valor (R$)<input className={`${ctrl} mt-1`} inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label className="text-xs text-slate-400">Categoria
        <input list="orcapro-finance-categories" className={`${ctrl} mt-1`} value={category}
          onChange={e=>setCategory(e.target.value)} placeholder="Escolha ou digite..." required/>
        <datalist id="orcapro-finance-categories">
          {['Materiais','Mão de obra','Equipamentos','Transporte','Fornecedores','Pagamento de cliente','Despesas administrativas','Impostos','Outros'].map(name=>
            <option key={name} value={name}/>)}
        </datalist>
      </label></div>
      <label className="block text-xs text-slate-400">Descrição<input className={`${ctrl} mt-1`} maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que foi pago ou recebido?" required/></label>
      <label className="block text-xs text-slate-400">Qual obra recebeu ou pagou?
        <select className={`${ctrl} mt-1`} aria-label="Vincular movimentação a uma obra"
          value={scheduleId} onChange={e=>{
            const id=e.target.value;setScheduleId(id);
            const work=schedules.find(s=>s.id===id);
            if(work?.quoteId)setQuoteId(work.quoteId);
            else if(id)setQuoteId('');
          }}>
          <option value="">Despesa ou recebimento geral da empresa</option>
          {schedules.map(s=><option key={s.id} value={s.id}>{s.title||'Obra sem nome'}{s.quoteId?' · com orçamento':''}</option>)}
        </select>
      </label>
      <label className="block text-xs text-slate-400">Vincular ao orçamento (opcional)
        <select className={`${ctrl} mt-1`} aria-label="Orçamento da movimentação"
          value={quoteId} onChange={e=>setQuoteId(e.target.value)}>
          <option value="">Sem orçamento</option>
          {quotes.filter(q=>!scheduleId||!schedules.find(s=>s.id===scheduleId)?.quoteId||
            q.id===schedules.find(s=>s.id===scheduleId)?.quoteId).map(q=>
            <option key={q.id} value={q.id}>{q.number} — {q.clientName} ({q.status})</option>)}
        </select>
      </label>
      {scheduleId&&<p className="text-[11px] text-sky-200">
        Este lançamento entrará no realizado da obra escolhida, mas não altera a medição física ou o orçamento.
      </p>}
      {error&&<p className="text-xs text-rose-300" role="alert">{error}</p>}
      <button type="submit" className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white hover:bg-orange-500">Salvar movimentação real</button>
      {syncStatus!=='saved'&&<p className="text-[11px] text-amber-300">Aguarde a confirmação de salvamento na nuvem antes de fechar.</p>}
    </form>
    <section aria-label="Comparativo financeiro por obra" className="space-y-3 rounded-2xl border border-sky-500/20 bg-[#141822] p-4">
      <h2 className="text-sm font-semibold text-white">Previsto × realizado por obra</h2>
      <p className="text-[11px] text-slate-300">Selecione a obra para ver apenas os pagamentos e recebimentos realmente lançados para ela. Custos do orçamento são previsões e nunca se tornam pagamentos automaticamente.</p>
      <label className="block text-xs text-slate-400">Obra analisada
        <select className={`${ctrl} mt-1`} aria-label="Selecionar obra para comparar custos" value={selectedWork}
          onChange={e=>setSelectedWork(e.target.value)}>
          <option value="">Selecione uma obra</option>
          {comparison.projects.map(w=><option key={w.scheduleId} value={w.scheduleId}>{w.title||'Obra sem nome'}</option>)}
        </select>
      </label>
      {comparison.projects.length===0&&<p className="text-xs text-amber-200">Cadastre uma obra no Cronograma SINAPI para comparar seus custos.</p>}
      {workSummary&&<>
        <div className="grid grid-cols-2 gap-2">
          {workSummary.plannedSale===null?
            <div className="rounded-2xl border border-white/10 bg-[#141822] p-4">
              <p className="text-[11px] text-slate-400">Proposta vinculada</p>
              <strong className="mt-2 block text-sm text-amber-200">Sem valor de proposta</strong>
              <p className="mt-1 text-[10px] text-slate-500">Vincule a obra a um orçamento para ver o valor previsto.</p>
            </div>:
            card('Proposta vinculada',workSummary.plannedSale,
              `Proposta ${workSummary.quoteNumber||''} · ${workSummary.quoteStatus||''} (não é recebido)`)}
          {card('Custos diretos conhecidos',workSummary.directCostKnown,
            `${workSummary.directCostCoveredItems} item(ns) com custo informado; não é gasto realizado`)}
          {card('Recebido nesta obra',workSummary.actualReceived,
            `${workSummary.receivedMovements} recebimento(s) registrados`)}
          {card('Despesas pagas nesta obra',workSummary.actualSpent,
            `${workSummary.paidMovements} pagamento(s) registrados`)}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200">
          <span className="block text-slate-400">Saldo dos lançamentos desta obra (não é lucro)</span>
          <strong className="text-base">{fmt(workSummary.actualCashBalance)}</strong>
        </div>
        {workSummary.plannedSale===null&&<p className="text-[11px] text-amber-200">Sem proposta vinculada. O valor de venda previsto não está disponível.</p>}
        {workSummary.directCostMissingItems>0&&<p className="text-[11px] text-amber-200">Custos previstos parciais: {workSummary.directCostMissingItems} item(ns) do orçamento sem custo confirmado. Não é possível estimar um lucro confiável.</p>}
        {workSummary.unassignedQuoteMovements>0&&<p className="text-[11px] text-amber-200">
          Há {workSummary.unassignedQuoteMovements} lançamento(s) de {fmt(workSummary.unassignedQuoteValue)} vinculados ao orçamento, mas sem obra identificada. Eles não entraram nos totais desta obra. Confira no extrato.
        </p>}
      </>}
      {(comparison.unlinkedSpent>0||comparison.unlinkedReceived>0)&&<p className="text-[11px] text-slate-400">
        Movimentações sem obra vinculada: {fmt(comparison.unlinkedSpent)} em despesas e {fmt(comparison.unlinkedReceived)} em recebimentos. Permanecem nos totais gerais.
      </p>}
    </section>
    <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141822] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><ReceiptText size={17} className="text-orange-400"/> Extrato de movimentos</h2><label className="text-xs text-slate-400">Período <select value={period} onChange={e=>setPeriod(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#0b0e15] px-2 py-1.5"><option value="todos">Todo período</option>{months.map(m=><option key={m} value={m}>{m}</option>)}</select></label></div>
      {display.length===0?<p className="py-5 text-center text-xs text-slate-500">Nenhum lançamento efetivo cadastrado neste período.</p>:display.map(item=><article key={item.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0b0e15] p-3"><span className={item.type==='recebimento'?'text-emerald-400':'text-rose-400'}>{item.type==='recebimento'?<TrendingUp size={18}/>:<TrendingDown size={18}/>}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-100">{item.description}</strong><p className="mt-1 text-[10px] text-slate-400">{item.date.split('-').reverse().join('/')} · {item.category}{item.quoteId?` · ${quotes.find(q=>q.id===item.quoteId)?.number||'Orçamento excluído'}`:''}{item.scheduleId?` · Obra: ${schedules.find(s=>s.id===item.scheduleId)?.title||'não encontrada'}`:''}</p></div><strong className={`text-xs ${item.type==='recebimento'?'text-emerald-300':'text-rose-300'}`}>{item.type==='recebimento'?'+':'−'} {fmt(item.amount)}</strong><button type="button" title="Excluir lançamento" aria-label={`Excluir lançamento ${item.description}`} onClick={()=>{if(window.confirm('Excluir este lançamento financeiro? Esta ação altera os totais.')) deleteFinanceEntry(item.id);}} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 size={15}/></button></article>)}
    </section>
    <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-slate-400"><AlertTriangle size={15} className="shrink-0"/><p>Não envie registros bancários sensíveis, números de cartão ou comprovantes com dados pessoais nos campos de descrição. Os lançamentos ficam no espaço de trabalho protegido da sua conta.</p></div>
  </div>;
};
