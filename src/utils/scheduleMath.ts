import type { WorkSchedule, ScheduleTask } from '../types/schedule';

export type TaskEstimate = {task: ScheduleTask; totalHH: number; days: number | null; start: string | null; end: string | null; warnings: string[]; labor: {role: string; code: string; hours: number; workers: number}[]};
export type ScheduleEstimate = {entries: TaskEstimate[]; totalHH: number; workingDays: number | null; finishDate: string | null; pending: number};

export function validScheduleDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const parse = (value: string) => new Date(`${value}T12:00:00Z`);
const key = (value: Date) => value.toISOString().slice(0, 10);
const holidaysOf = (holidays: string[]) => new Set(holidays);
export function nextWorkday(date: string, holidays: string[] = []): string | null {
  if (!validScheduleDate(date)) return null;
  const d = parse(date); const blocked = holidaysOf(holidays);
  for (let i = 0; i <= 10000; i++) {
    const k = key(d);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !blocked.has(k)) return k;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}
export function advanceWorkdays(date: string, days: number, holidays: string[] = []): string | null {
  if (!Number.isSafeInteger(days) || days < 1 || days > 10000) return null;
  let cursor = nextWorkday(date, holidays);
  if (!cursor) return null;
  for (let i = 1; i < days; i++) {
    const d = parse(cursor); d.setUTCDate(d.getUTCDate() + 1);
    cursor = nextWorkday(key(d), holidays);
    if (!cursor) return null;
  }
  return cursor;
}
export function afterWorkdays(date: string, days: number, holidays: string[] = []): string | null {
  const end = advanceWorkdays(date, days, holidays);
  if (!end) return null;
  const d = parse(end); d.setUTCDate(d.getUTCDate() + 1);
  return nextWorkday(key(d), holidays);
}
export function workingDaysBetween(start: string, end: string, holidays: string[] = []): number | null {
  if (!validScheduleDate(start) || !validScheduleDate(end) || start > end) return null;
  let cursor = nextWorkday(start, holidays), count = 0;
  while (cursor && cursor <= end && count < 10000) {
    count++;
    const d = parse(cursor); d.setUTCDate(d.getUTCDate() + 1);
    cursor = nextWorkday(key(d), holidays);
  }
  return count < 10000 ? count : null;
}

export function estimateSchedule(plan: WorkSchedule): ScheduleEstimate {
  const holidays = plan.holidays || [];
  const validCalendar = holidays.length <= 366 && holidays.every(validScheduleDate);
  const mode = plan.scheduleMode || 'sequencial';
  const validDay = Number.isFinite(plan.hoursPerDay) && plan.hoursPerDay > 0 && plan.hoursPerDay <= 24;
  const validEfficiency = Number.isFinite(plan.efficiency) && plan.efficiency > 0 && plan.efficiency <= 1;
  const startOfWork = validCalendar ? nextWorkday(plan.startDate, holidays) : null;
  const map = new Map(plan.tasks.map((task, i) => [task.id, i] as const));
  const memo = new Map<number, TaskEstimate>();
  const state = new Map<number, 'visiting' | 'done'>();

  function calculate(task: ScheduleTask, index: number): TaskEstimate {
    if (memo.has(index)) return memo.get(index)!;
    // Detect cycles without pretending that the first activity has a valid date.
    if (state.get(index) === 'visiting') {
      return {task, totalHH: 0, days: null, start: null, end: null, labor: [], warnings: ['Dependência circular entre atividades.']};
    }
    state.set(index, 'visiting');
    const warnings: string[] = [];
    const labor = (task.composition?.labor || []).map(l => ({role: l.role, code: l.code, hours: l.hoursPerUnit * task.quantity, workers: task.crew?.[`${l.code}:${l.role}`] || 0}));
    const validQuantity = Number.isFinite(task.quantity) && task.quantity > 0;
    const validLabor = labor.length > 0 && labor.every(l => Number.isFinite(l.hours) && l.hours > 0);
    if (!validQuantity) warnings.push('Informe quantidade maior que zero.');
    if (!validLabor) warnings.push('Coeficiente de mão de obra inválido ou ausente.');
    if (!validDay || !validEfficiency) warnings.push('Jornada ou eficiência inválida.');
    if (!validCalendar) warnings.push('Revise as datas não úteis: devem ser válidas e até 366 dias.');
    if (!startOfWork) warnings.push('Data inicial inválida.');
    if (labor.some(l => !Number.isInteger(l.workers) || l.workers < 1 || l.workers > 500)) warnings.push('Informe de 1 a 500 profissionais para cada função.');
    const totalHH = validQuantity && validLabor ? labor.reduce((sum, l) => sum + l.hours, 0) : 0;
    const calculated = warnings.length === 0 ? Math.max(1, ...labor.map(l => Math.ceil(l.hours / (l.workers * plan.hoursPerDay * plan.efficiency)))) : null;
    if (calculated !== null && calculated > 10000) warnings.push('Prazo calculado excede o limite suportado.');

    // No explicit migration: existing plans remain sequential until user opts into dependencies.
    const predecessors = mode === 'dependencias' ? (task.dependencies || []) : index ? [plan.tasks[index - 1].id] : [];
    if (mode === 'dependencias' && map.size !== plan.tasks.length) warnings.push('IDs de etapas repetidos impedem resolver as dependências.');
    let earliest = startOfWork;
    if (new Set(predecessors).size !== predecessors.length) warnings.push('Dependência repetida.');
    for (const id of predecessors) {
      const depIndex = mode === 'sequencial' ? index - 1 : map.get(id);
      if ((mode === 'dependencias' && id === task.id) || depIndex === undefined) {warnings.push('Dependência inválida ou aponta para a própria atividade.'); continue;}
      const previous = calculate(plan.tasks[depIndex], depIndex);
      if (!previous.end) {warnings.push('Atividade predecessora sem previsão válida ou dependência circular.'); continue;}
      const possible = afterWorkdays(previous.end, 1, holidays);
      if (!possible) {warnings.push('Data da predecessora excede o período suportado.'); continue;}
      if (!earliest || possible > earliest) earliest = possible;
    }
    const days = warnings.length ? null : calculated;
    const start = days !== null ? earliest : null;
    const end = days !== null && start ? advanceWorkdays(start, days, holidays) : null;
    if (days !== null && !end) warnings.push('Data calculada fora do período suportado.');
    const result = {task, totalHH, days: warnings.length ? null : days, start: warnings.length ? null : start, end: warnings.length ? null : end, warnings, labor};
    memo.set(index, result);
    state.set(index, 'done');
    return result;
  }
  const entries = plan.tasks.map(calculate);
  const pending = entries.filter(e => !e.end).length;
  const totalHH = entries.reduce((sum, e) => sum + e.totalHH, 0);
  const finishDate = pending || !entries.length ? null : entries.reduce((max, e) => e.end! > max ? e.end! : max, entries[0].end!);
  const workingDays = finishDate && startOfWork ? workingDaysBetween(startOfWork, finishDate, holidays) : null;
  return {entries, totalHH, workingDays, finishDate, pending};
}
