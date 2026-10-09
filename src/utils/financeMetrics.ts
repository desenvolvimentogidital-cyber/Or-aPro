import type { FinanceEntry } from '../types/finance';
import type { Quote } from '../types/index';
import { validISODate } from './execution.js';
export function validateEntry(entry: FinanceEntry): void {
  if (!entry.id || !entry.description.trim() || !entry.category.trim() || !entry.createdAt) throw new Error('Preencha a descrição e a categoria.');
  if (entry.type !== 'recebimento' && entry.type !== 'despesa') throw new Error('Tipo de lançamento inválido.');
  if (!validISODate(entry.date)) throw new Error('Data do lançamento inválida.');
  if (!Number.isFinite(entry.amount) || entry.amount <= 0 || entry.amount > 1e12) throw new Error('Valor deve ser maior que zero.');
}
export function financeMetrics(entries: FinanceEntry[], quotes: Quote[]) {
  const valid = entries.filter(e => { try {validateEntry(e); return true;} catch{return false;} });
  const received = valid.filter(e => e.type === 'recebimento').reduce((s,e)=>s+e.amount,0);
  const spent = valid.filter(e => e.type === 'despesa').reduce((s,e)=>s+e.amount,0);
  const approved = quotes.filter(q => q.status === 'aprovado' && Number.isFinite(q.total) && q.total >= 0);
  const approvedValue = approved.reduce((s,q)=>s+q.total,0);
  const receivedOnApproved = approved.reduce((s,q)=>s+valid.filter(e=>e.type==='recebimento'&&e.quoteId===q.id).reduce((x,e)=>x+e.amount,0),0);
  const overdueReceivable = approved.reduce((s,q)=>s+Math.max(0,q.total-valid.filter(e=>e.type==='recebimento'&&e.quoteId===q.id).reduce((x,e)=>x+e.amount,0)),0);
  const perQuote = approved.map(q=>({id:q.id, number:q.number, total:q.total, received:valid.filter(e=>e.type==='recebimento'&&e.quoteId===q.id).reduce((x,e)=>x+e.amount,0)}));
  return { received, spent, cashBalance: received-spent, approvedValue, receivedOnApproved, receivable: overdueReceivable, perQuote, overpaidQuotes: perQuote.filter(q=>q.received>q.total+0.00001).length, invalidEntries: entries.length-valid.length };
}
