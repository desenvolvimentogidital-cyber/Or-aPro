import type { WorkSchedule, ScheduleTask, TaskProgressEntry } from '../types/schedule';

export function validISODate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function measuredQuantity(task: ScheduleTask): number {
  return (task.progress || []).reduce((sum, p) => sum + (Number.isFinite(p.quantity) && p.quantity > 0 ? p.quantity : 0), 0);
}
export function progressPercent(task: ScheduleTask): number | null {
  if (!Number.isFinite(task.quantity) || task.quantity <= 0) return null;
  return Math.min(100, Math.max(0, 100 * measuredQuantity(task) / task.quantity));
}
export function addMeasurement(task: ScheduleTask, entry: TaskProgressEntry): ScheduleTask {
  if (!validISODate(entry.date)) throw new Error('Informe uma data válida de execução.');
  if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) throw new Error('A medição deve ser maior que zero.');
  if (!Number.isFinite(task.quantity) || task.quantity <= 0) throw new Error('Informe o quantitativo contratado.');
  if (measuredQuantity(task) + entry.quantity > task.quantity + 0.0000001) throw new Error('A execução medida não pode exceder o quantitativo previsto.');
  if (!entry.id || !entry.recordedAt) throw new Error('Medição sem identificação ou data de registro.');
  return {...task, progress: [...(task.progress || []), entry]};
}
export function physicalProgress(schedule: WorkSchedule): { measured: number; planned: number; percent: number | null; completed: number } {
  const valid = schedule.tasks.filter(t => Number.isFinite(t.quantity) && t.quantity > 0);
  const planned = valid.reduce((s,t) => s + t.quantity, 0);
  // Different units cannot be summed as one overall physical measure.
  const measured = valid.reduce((s,t) => s + Math.min(t.quantity, measuredQuantity(t)), 0);
  const completed = valid.filter(t => measuredQuantity(t) + 0.000001 >= t.quantity).length;
  const percent = valid.length === 0 ? null : valid.reduce((s,t) => s + (progressPercent(t) || 0), 0)/valid.length;
  return {measured, planned, percent, completed};
}
