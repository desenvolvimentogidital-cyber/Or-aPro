import type { Quote, QuoteItem } from '../types';

export function finiteNonnegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Informe um valor numérico maior ou igual a zero.');
  return value;
}

export function validateRate(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${label} deve estar entre 0 e 100%.`);
  return value;
}

export function pricingEstimate(input: {
  monthlyExpenses: number; workDays: number; workHours: number; margin: number; tax: number;
  material: number; jobHours: number; travel: number;
}) {
  const monthly = finiteNonnegative(input.monthlyExpenses);
  const days = finiteNonnegative(input.workDays);
  const hours = finiteNonnegative(input.workHours);
  if (days === 0 || hours === 0) throw new Error('Dias e horas trabalhadas devem ser maiores que zero.');
  const margin = validateRate(input.margin, 'Margem');
  const tax = validateRate(input.tax, 'Imposto');
  if (margin + tax >= 100) throw new Error('A soma de margem e imposto deve ser inferior a 100%.');
  const directCost = finiteNonnegative(input.material) + finiteNonnegative(input.jobHours) * (monthly / hours) + finiteNonnegative(input.travel);
  const markup = 1 / (1 - (margin + tax) / 100);
  const price = directCost * markup;
  return { costPerDay: monthly / days, costPerHour: monthly / hours, markup, directCost, price, profit: price - directCost - price * tax / 100 };
}

export function quoteTotals(input: {
  items: QuoteItem[]; travelCost: number; otherCosts?: number;
  discountType: Quote['discountType']; discountValue: number; taxRate: number;
}) {
  const travel = finiteNonnegative(input.travelCost);
  const other = finiteNonnegative(input.otherCosts ?? 0);
  const itemSubtotal = input.items.reduce((sum, item) => sum + finiteNonnegative(item.quantity) * finiteNonnegative(item.unitPrice), 0);
  const subtotal = itemSubtotal + travel + other;
  const discountInput = finiteNonnegative(input.discountValue);
  if (input.discountType === 'percentage') validateRate(discountInput, 'Desconto');
  const discount = input.discountType === 'percentage' ? subtotal * discountInput / 100 : discountInput;
  if (discount > subtotal) throw new Error('O desconto não pode ultrapassar o subtotal.');
  const tax = validateRate(input.taxRate, 'Imposto');
  const total = subtotal - discount;
  // Cost is deliberately NOT inferred from sale price. Missing cost is treated as zero and flagged.
  const missingCostCount = input.items.filter(item => item.unitCost === undefined || item.unitCost === null || (item.unitCost === 0 && item.costConfirmed !== true)).length;
  const itemCosts = input.items.reduce((sum, item) => sum + finiteNonnegative(item.unitCost ?? 0) * item.quantity, 0);
  const netProfit = total - itemCosts - travel - other - total * tax / 100;
  return { subtotal, total, discount, netProfit, missingCostCount };
}

export function nextQuoteNumber(quotes: Pick<Quote, 'number'>[], lastIssued = 0): string {
  const highest = quotes.reduce((max, quote) => {
    const match = /^#(\d+)$/.exec(quote.number);
    return match ? Math.max(max, Number(match[1])) : max;
  }, lastIssued);
  return `#${String(highest + 1).padStart(3, '0')}`;
}

export function newId(prefix: string): string {
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${id}`;
}

export function approvedRevenue(quotes: Pick<Quote, 'status' | 'total' | 'date'>[], start?: Date, end?: Date): number {
  return quotes.filter(q => q.status === 'aprovado' && (!start || q.date >= dateKey(start)) && (!end || q.date < dateKey(end))).reduce((sum, q) => sum + q.total, 0);
}

export function dateKey(date: Date): string {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function monthlyApprovedTotals(quotes: Pick<Quote, 'status'|'total'|'date'>[], count = 8, now = new Date()): number[] {
  return Array.from({length: count}, (_, index) => {
    const offset = count - index - 1;
    return approvedRevenue(quotes, new Date(now.getFullYear(), now.getMonth() - offset, 1), new Date(now.getFullYear(), now.getMonth() - offset + 1, 1));
  });
}
