import type { WorkSchedule } from '../types/schedule';
import type { Quote } from '../types/index';
import { progressPercent } from './execution.js';

const normUnit = (unit: string) => (unit || '').trim().toUpperCase().replace(/²/g, '2').replace(/³/g,'3').replace(/\s+/g,'');
export interface TaskFinancialMeasure {taskId: string; itemId: string; planned: number; measured: number; percent: number}
export interface PhysicalFinancialSummary {planned: number; measured: number; percent: number | null; linked: TaskFinancialMeasure[]; issues: string[]; unlinkedTasks: number; uncoveredItems: number}

/** Valores físicos-financeiros são proporção dos itens expressamente associados, NÃO faturamento ou pagamento. */
export function physicalFinancial(schedule: WorkSchedule, quote?: Quote): PhysicalFinancialSummary {
  const issues: string[] = []; const linked: TaskFinancialMeasure[] = [];
  if (!quote) return {planned:0, measured:0, percent:null, linked, issues:['Vincule um orçamento existente para obter valores físicos-financeiros.'],unlinkedTasks:schedule.tasks.length,uncoveredItems:0};
  const linkedIds = new Set<string>();
  let unlinkedTasks=0;
  for (const task of schedule.tasks) {
    if (!task.quoteItemId) {unlinkedTasks++;continue;}
    const item = quote.items.find(i => i.id === task.quoteItemId);
    if (!item) {issues.push(`Etapa ${task.composition.code}: item associado não existe mais no orçamento.`);continue;}
    if (linkedIds.has(item.id)) {issues.push(`Item ${item.name}: associado a mais de uma etapa; valor ignorado para evitar duplicação.`);continue;}
    if (normUnit(item.unit) !== normUnit(task.composition.unit)) {issues.push(`Etapa ${task.composition.code}: unidade diferente da proposta (${item.unit} versus ${task.composition.unit}).`);continue;}
    if (!Number.isFinite(item.totalPrice) || item.totalPrice < 0 || !Number.isFinite(item.quantity) || item.quantity <= 0 || Math.abs(task.quantity - item.quantity) > 0.000001) {
      issues.push(`Etapa ${task.composition.code}: revise quantidade e valor do item da proposta.`);continue;
    }
    linkedIds.add(item.id);
    const percent = progressPercent(task);
    if (percent === null) {issues.push(`Etapa ${task.composition.code}: quantidade física inválida.`);continue;}
    linked.push({taskId:task.id,itemId:item.id,planned:item.totalPrice,measured:item.totalPrice*percent/100,percent});
  }
  const planned = linked.reduce((sum,x)=>sum+x.planned,0);
  const measured = linked.reduce((sum,x)=>sum+x.measured,0);
  const uncoveredItems = quote.items.filter(item=>!linkedIds.has(item.id)).length;
  if (uncoveredItems) issues.push(`${uncoveredItems} item(ns) da proposta não cobertos: impostos, deslocamento e demais valores também não entram nesta medição.`);
  return {planned,measured,percent:planned>0?100*measured/planned:null,linked,issues,unlinkedTasks,uncoveredItems};
}
