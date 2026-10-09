import type {WorkSchedule, WorkDiaryEntry, OperationalStatus} from '../types/schedule';
import {validScheduleDate} from './scheduleMath.js';
export function validateDiaryEntry(e: WorkDiaryEntry): void {
  if (!e.id || !e.createdAt || !Number.isFinite(Date.parse(e.createdAt))) throw new Error('Identificação ou data de registro inválida.');
  if (!validScheduleDate(e.date)) throw new Error('Informe a data real da ocorrência.');
  if (!['diario','ocorrencia','inspecao'].includes(e.kind)) throw new Error('Tipo de registro inválido.');
  if (e.description.trim().length < 5 || e.description.length > 3000) throw new Error('Descreva a atividade ou ocorrência (5 a 3000 caracteres).');
  if (!e.responsible.trim() || e.responsible.length > 120) throw new Error('Informe o responsável pelo registro.');
  if (e.workerCount !== undefined && (!Number.isInteger(e.workerCount) || e.workerCount < 0 || e.workerCount > 10000)) throw new Error('Quantidade de trabalhadores inválida.');
}
export function addDiaryRecord(schedule: WorkSchedule, entry: WorkDiaryEntry): WorkSchedule {
  validateDiaryEntry(entry);
  if ((schedule.diary || []).some(e=>e.id===entry.id)) throw new Error('Registro duplicado.');
  if ((schedule.diary || []).length >= 3000) throw new Error('Limite de registros atingido. Exporte o diário antes de continuar.');
  return {...schedule,diary:[...(schedule.diary||[]),entry],updatedAt:new Date().toISOString()};
}
export function validStatus(status: string): status is OperationalStatus {
  return ['planejamento','em_execucao','paralisada','concluida'].includes(status);
}
