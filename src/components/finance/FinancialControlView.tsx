import React, { useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, ReceiptText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { financeMetrics } from '../../utils/financeMetrics';
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
  const {financeEntries,addFinanceEntry,deleteFinanceEntry,quotes,syncStatus}=useApp();
  const [type,setType]=useState<FinanceEntry['type']>('recebimento');
  const [date,setDate]=useState(today);
  const [amount,setAmount]=useState('');
  const [description,setDescription]=useState('');
  const [category,setCategory]=useState('');
  const [quoteId,setQuoteId]=useState('');
  const [error,setError]=useState('');
  const [period,setPeriod]=useState('todos');
  const metrics=useMemo(()=>financeMetrics(financeEntries,quotes),[financeEntries,quotes]);
  const display=useMemo(()=>financeEntries.filter(e=>period==='todos'||e.date.startsWith(period)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[financeEntries,period]);
  const months=[...new Set(financeEntries.map(e=>e.date.slice(0,7)))].filter(s=>/^\d{4}-\d{2}$/.test(s)).sort().reverse();
  const save=(e:React.FormEvent)=>{
    e.preventDefault();
    const entry:FinanceEntry={id:newId('mov'),type,date,amount:parseMoney(amount),description:description.trim(),category:category.trim(),quoteId:quoteId||undefined,createdAt:new Date().toISOString()};
    try {addFinanceEntry(entry);setAmount('');setDescription('');setCategory('');setQuoteId('');setError('');}
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
      <div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-400">Valor (R$)<input className={`${ctrl} mt-1`} inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label className="text-xs text-slate-400">Categoria<input className={`${ctrl} mt-1`} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Materiais, mão de obra..." required/></label></div>
      <label className="block text-xs text-slate-400">Descrição<input className={`${ctrl} mt-1`} maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que foi pago ou recebido?" required/></label>
      <label className="block text-xs text-slate-400">Vincular ao orçamento (opcional)<select className={`${ctrl} mt-1`} value={quoteId} onChange={e=>setQuoteId(e.target.value)}><option value="">Movimentação geral, sem orçamento</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.number} — {q.clientName} ({q.status})</option>)}</select></label>
      {error&&<p className="text-xs text-rose-300" role="alert">{error}</p>}
      <button type="submit" className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white hover:bg-orange-500">Salvar movimentação real</button>
      {syncStatus!=='saved'&&<p className="text-[11px] text-amber-300">Aguarde a confirmação de salvamento na nuvem antes de fechar.</p>}
    </form>
    <section className="space-y-3 rounded-2xl border border-white/10 bg-[#141822] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><ReceiptText size={17} className="text-orange-400"/> Extrato de movimentos</h2><label className="text-xs text-slate-400">Período <select value={period} onChange={e=>setPeriod(e.target.value)} className="ml-2 rounded-lg border border-white/10 bg-[#0b0e15] px-2 py-1.5"><option value="todos">Todo período</option>{months.map(m=><option key={m} value={m}>{m}</option>)}</select></label></div>
      {display.length===0?<p className="py-5 text-center text-xs text-slate-500">Nenhum lançamento efetivo cadastrado neste período.</p>:display.map(item=><article key={item.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0b0e15] p-3"><span className={item.type==='recebimento'?'text-emerald-400':'text-rose-400'}>{item.type==='recebimento'?<TrendingUp size={18}/>:<TrendingDown size={18}/>}</span><div className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-100">{item.description}</strong><p className="mt-1 text-[10px] text-slate-400">{item.date.split('-').reverse().join('/')} · {item.category}{item.quoteId?` · ${quotes.find(q=>q.id===item.quoteId)?.number||'Orçamento excluído'}`:''}</p></div><strong className={`text-xs ${item.type==='recebimento'?'text-emerald-300':'text-rose-300'}`}>{item.type==='recebimento'?'+':'−'} {fmt(item.amount)}</strong><button type="button" title="Excluir lançamento" aria-label={`Excluir lançamento ${item.description}`} onClick={()=>{if(window.confirm('Excluir este lançamento financeiro? Esta ação altera os totais.')) deleteFinanceEntry(item.id);}} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 size={15}/></button></article>)}
    </section>
    <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-slate-400"><AlertTriangle size={15} className="shrink-0"/><p>Não envie registros bancários sensíveis, números de cartão ou comprovantes com dados pessoais nos campos de descrição. Os lançamentos ficam no espaço de trabalho protegido da sua conta.</p></div>
  </div>;
};
