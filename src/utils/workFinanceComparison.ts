import type {FinanceEntry} from '../types/finance.js';
import type {Quote} from '../types/index.js';
import type {WorkSchedule} from '../types/schedule.js';
import {validateEntry} from './financeMetrics.js';

const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export interface WorkFinanceRow{
  scheduleId:string;title:string;quoteId?:string;quoteNumber?:string;
  quoteStatus?:string;
  plannedSale:number|null;
  directCostKnown:number;
  directCostMissingItems:number;
  directCostCoveredItems:number;
  actualReceived:number;
  actualSpent:number;
  actualCashBalance:number;
  unassignedQuoteMovements:number;
  unassignedQuoteValue:number;
  paidMovements:number;
  receivedMovements:number;
}
export interface WorkFinanceComparison{projects:WorkFinanceRow[];unlinkedReceived:number;unlinkedSpent:number;invalidEntries:number;}
/** Apenas lançamentos COM OBRA declarada entram no real da obra.
 * Financeiro com apenas quoteId não é atribuído por coincidência a cronogramas.
 * Custo direto planejado é soma dos custos unitários informados dos itens,
 * não é um valor financeiro efetivamente pago e não presume impostos, RH ou indiretos.
 */
export function compareWorkFinance(
  schedules:readonly WorkSchedule[],quotes:readonly Quote[],entries:readonly FinanceEntry[]
):WorkFinanceComparison {
  const valid:FinanceEntry[]=[];
  let invalidEntries=0;
  for(const e of entries){
    try{validateEntry(e);valid.push(e);}catch{invalidEntries++;}
  }
  const scheduleIds=new Set(schedules.map(s=>s.id));
  const projects=schedules.map(schedule=>{
    const quote=quotes.find(q=>q.id===schedule.quoteId);
    const records=valid.filter(e=>e.scheduleId===schedule.id);
    const received=records.filter(e=>e.type==='recebimento');
    const spent=records.filter(e=>e.type==='despesa');
    const missing=quote?.items.filter(item=>
      item.unitCost===undefined||item.unitCost===null||!Number.isFinite(item.unitCost)||
      item.unitCost<0||!(item.costConfirmed===true || item.costConfirmed===undefined && item.unitCost>=0))||[];
    const known=quote?.items.filter(item=>!missing.includes(item))||[];
    const directCostKnown=known.reduce((sum,item)=>sum+item.unitCost!*item.quantity,0);
    // quoteId sozinho não garante a qual obra pertence (pode haver múltiplos cronogramas).
    const unassigned=quote?valid.filter(e=>e.quoteId===quote.id&&!e.scheduleId):[];
    const unassignedQuoteValue=unassigned.reduce((sum,e)=>sum+e.amount,0);
    const actualReceived=round(received.reduce((sum,e)=>sum+e.amount,0));
    const actualSpent=round(spent.reduce((sum,e)=>sum+e.amount,0));
    return {scheduleId:schedule.id,title:schedule.title,quoteId:quote?.id,
      quoteNumber:quote?.number,quoteStatus:quote?.status,
      plannedSale:quote&&Number.isFinite(quote.total)&&quote.total>=0?round(quote.total):null,
      directCostKnown:round(directCostKnown),directCostMissingItems:missing.length,
      directCostCoveredItems:known.length,actualReceived,actualSpent,
      actualCashBalance:round(actualReceived-actualSpent),
      unassignedQuoteMovements:unassigned.length,
      unassignedQuoteValue:round(unassignedQuoteValue),
      paidMovements:spent.length,receivedMovements:received.length
    };
  });
  const unlinked=valid.filter(e=>!e.scheduleId||!scheduleIds.has(e.scheduleId));
  return {projects,
    unlinkedReceived:round(unlinked.filter(e=>e.type==='recebimento').reduce((s,e)=>s+e.amount,0)),
    unlinkedSpent:round(unlinked.filter(e=>e.type==='despesa').reduce((s,e)=>s+e.amount,0)),
    invalidEntries};
}
/** A data financeira é persistida SEM inventar um novo orçamento.
 * Caso a obra tenha proposta vinculada, não deixa registrar um orçamento diferente.
 */
export function financialWorkQuoteId(
  scheduleId:string,quoteId:string,schedules:readonly WorkSchedule[]
):{scheduleId?:string;quoteId?:string}{
  if(!scheduleId)return {quoteId:quoteId||undefined};
  const selected=schedules.find(s=>s.id===scheduleId);
  if(!selected)throw Error('Obra não encontrada. Atualize a lista antes de salvar.');
  if(quoteId&&selected.quoteId&&quoteId!==selected.quoteId)
    throw Error('O orçamento escolhido não corresponde à obra. Selecione a proposta vinculada.');
  return {scheduleId,quoteId:selected.quoteId||quoteId||undefined};
}
