import type { Quote } from '../types';

export type DashboardPeriod = 'mes' | 'trimestre' | 'ano' | 'tudo';
type QuoteRecord = Pick<Quote, 'id' | 'status' | 'date' | 'total' | 'items' | 'taxRate' | 'travelCost' | 'otherCosts' | 'history'>;

const isAmount = (value: number): boolean => Number.isFinite(value) && value >= 0;
const isDate = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(new Date(`${key}T12:00:00Z`).getTime()) && new Date(`${key}T12:00:00Z`).toISOString().slice(0, 10) === key;
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
const dateInPeriod = (value: string, start: string, end: string) => isDate(value) && value >= start && value < end;

export function dashboardBounds(period: DashboardPeriod, today = new Date()) {
  const year = today.getFullYear(), month = today.getMonth();
  const start = period === 'tudo' ? '0000-01-01' : period === 'ano' ? localDate(new Date(year, 0, 1)) : period === 'trimestre' ? localDate(new Date(year, month - 2, 1)) : localDate(new Date(year, month, 1));
  const end = localDate(new Date(year, month + 1, 1));
  return { start, end };
}

// History records a manual or public-link approval. An imported historical quote may
// lack that event; its original issue date is the transparent fallback.
export function approvalDate(quote: Pick<Quote, 'date' | 'history'>): string {
  const approvals = (quote.history ?? []).filter(event =>
    /(?:alterado manualmente para aprovado|link público: aprovado)/i.test(event.action) &&
    typeof event.date === 'string' && isDate(event.date.slice(0, 10))
  );
  return approvals.length ? approvals[approvals.length - 1].date.slice(0, 10) : quote.date;
}

/** Valid only when every direct item cost was supplied. Monthly overhead and payment
 * receipt are NOT recorded by the current model, so this is an estimate, not accounting net income.
 */
export function quoteEstimatedProfit(quote: QuoteRecord): number | null {
  if (!isAmount(quote.total) || !isAmount(quote.travelCost) || !isAmount(quote.otherCosts ?? 0) ||
      !Number.isFinite(quote.taxRate) || quote.taxRate < 0 || quote.taxRate > 100 || !Array.isArray(quote.items)) return null;
  let directCosts = 0;
  for (const item of quote.items) {
    if (item.unitCost === undefined || item.unitCost === null || !isAmount(item.unitCost) || (item.unitCost === 0 && item.costConfirmed !== true) || !isAmount(item.quantity)) return null;
    directCosts += item.unitCost * item.quantity;
  }
  return quote.total - directCosts - quote.travelCost - (quote.otherCosts ?? 0) - quote.total * quote.taxRate / 100;
}

export function dashboardSummary(quotes: QuoteRecord[], period: DashboardPeriod, today = new Date()) {
  const {start, end} = dashboardBounds(period, today);
  const issued = quotes.filter(q => q.status !== 'rascunho' && dateInPeriod(q.date, start, end));
  const created = quotes.filter(q => dateInPeriod(q.date, start, end));
  const approved = quotes.filter(q => q.status === 'aprovado' && dateInPeriod(approvalDate(q), start, end));
  const awaiting = issued.filter(q => q.status === 'enviado');
  const safeSum = (rows: QuoteRecord[]) => rows.reduce((sum, q) => sum + (isAmount(q.total) ? q.total : 0), 0);
  const incompleteFinancial = approved.filter(q => quoteEstimatedProfit(q) === null);
  const validatedProfit = approved.reduce((sum, q) => sum + (quoteEstimatedProfit(q) ?? 0), 0);
  const statuses = {
    enviado: issued.filter(q=>q.status==='enviado').length,
    aprovado: issued.filter(q=>q.status==='aprovado').length,
    recusado: issued.filter(q=>q.status==='recusado').length,
    rascunho: created.filter(q=>q.status==='rascunho').length
  };
  const evaluated = statuses.aprovado + statuses.recusado;
  return {
    totalQuotes: created.length, issuedCount: issued.length, issuedValue: safeSum(issued),
    awaitingCount: awaiting.length, awaitingValue: safeSum(awaiting),
    approvedCount: approved.length, approvedValue: safeSum(approved),
    estimatedProfit: validatedProfit, profitComplete: incompleteFinancial.length === 0,
    incompleteProfitCount: incompleteFinancial.length,
    invalidAmountCount: new Set([...issued, ...approved].filter(q=>!isAmount(q.total)).map(q=>q.id)).size,
    approvalRate: evaluated ? statuses.aprovado / evaluated * 100 : null,
    statuses
  };
}

export function dashboardMonthlySeries(quotes: QuoteRecord[], months = 6, today = new Date()) {
  return Array.from({length:months}, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (months - 1 - i), 1);
    const month = localDate(date).slice(0, 7);
    const rows = quotes.filter(q => isAmount(q.total));
    return {
      month,
      label: date.toLocaleDateString('pt-BR',{month:'short'}).replace('.', ''),
      issued: rows.filter(q=>q.status!=='rascunho' && q.date?.slice(0,7)===month).reduce((n,q)=>n+q.total,0),
      approved: rows.filter(q=>q.status==='aprovado' && approvalDate(q)?.slice(0,7)===month).reduce((n,q)=>n+q.total,0),
      awaiting: rows.filter(q=>q.status==='enviado' && q.date?.slice(0,7)===month).reduce((n,q)=>n+q.total,0)
    };
  });
}

export function recentlyChangedQuotes<T extends Pick<Quote,'date'|'history'>>(quotes:T[], limit=5):T[] {
  const latest = (q:T) => {
    const dates = [q.date, ...(q.history ?? []).map(h=>h.date)].filter(Boolean).sort();
    return dates.at(-1) ?? '';
  };
  return [...quotes].sort((a,b)=>latest(b).localeCompare(latest(a))).slice(0,limit);
}
