/**
 * Jornada operacional declarada pela empresa para distribuição dos custos fixos.
 * Não equivale a jornadas SINAPI, duração da obra nem disponibilidade de equipes.
 * Sem dados do usuário, não presume 22 dias ou 8h por dia.
 */
export interface PricingWorkload {
  days: number;
  hoursPerDay: number;
  hoursPerMonth: number;
  valid: boolean;
  missing: boolean;
  message: string;
}

export function pricingWorkload(
  daysValue?: number,
  hoursPerDayValue?: number
): PricingWorkload {
  const days = daysValue ?? 0;
  const hoursPerDay = hoursPerDayValue ?? 0;
  const missing = daysValue === undefined || hoursPerDayValue === undefined ||
    daysValue === 0 || hoursPerDayValue === 0;
  const valid = Number.isInteger(days) && days >= 1 && days <= 31 &&
    Number.isFinite(hoursPerDay) && hoursPerDay >= 0.5 && hoursPerDay <= 24;
  const hoursPerMonth = valid ? Number((days * hoursPerDay).toFixed(4)) : 0;

  let message = '';
  if(!valid) {
    message = missing
      ? 'Informe os dias trabalhados no mês e as horas por dia para calcular seu custo por hora.'
      : 'Use de 1 a 31 dias inteiros por mês e de 0,5 a 24 horas de trabalho por dia.';
  }
  return {days,hoursPerDay,hoursPerMonth,valid,missing,message};
}
