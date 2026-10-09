import type { WorkSchedule } from '../types/schedule';

/** Prioriza um cronograma com etapas quando não houver seleção explícita.
 * Uma seleção manual, mesmo de cronograma vazio, é sempre respeitada.
 */
export function resolveScheduleSelection(
  schedules: WorkSchedule[], selectedId: string,
): WorkSchedule | null {
  return schedules.find(schedule => schedule.id === selectedId)
    || schedules.find(schedule => Array.isArray(schedule.tasks) && schedule.tasks.length > 0)
    || schedules[0]
    || null;
}
