import type { Quote, Client, MonthlyExpense } from '../types';
import { approvedRevenue } from './quoteMath.js';

// Quote every cell, and neutralize spreadsheet formulas even after leading whitespace/control characters.
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  const sanitized = /^[\s\u0000-\u001f]*[=+@-]/.test(text) && !/^-\d+(?:\.\d+)?$/.test(text) ? `'${text}` : text;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

export function makeCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}

function downloadCsv(rows: unknown[][], filename: string) {
  const blob = new Blob([makeCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const today = () => new Date().toISOString().slice(0, 10);

export const exportQuotesToCSV = (quotes: Quote[]) => downloadCsv([
  ['Número', 'Cliente', 'Telefone', 'Email', 'Data', 'Validade', 'Status', 'Subtotal (R$)', 'Desconto (R$)', 'Imposto (%)', 'Total (R$)', 'Lucro estimado (R$)', 'Qtd. itens'],
  ...quotes.map(q => [q.number, q.clientName, q.clientPhone, q.clientEmail, q.date, q.validUntil, q.status, q.subtotal.toFixed(2), q.discountValue.toFixed(2), q.taxRate.toFixed(2), q.total.toFixed(2), q.netProfit.toFixed(2), q.items.length])
], `orcamentos_${today()}.csv`);

export const exportFinancialReportToCSV = (quotes: Quote[], expenses: MonthlyExpense[]) => downloadCsv([
  ['RELATÓRIO FINANCEIRO CONSOLIDADO'],
  ['Data da exportação', new Date().toLocaleDateString('pt-BR')],
  ['Receita total aprovada (não necessariamente recebida)', approvedRevenue(quotes).toFixed(2)],
  ['Despesas mensais cadastradas', expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)],
  [], ['DESPESAS MENSAIS'], ['Categoria', 'Despesa', 'Valor (R$)'],
  ...expenses.map(exp => [exp.category, exp.name, exp.amount.toFixed(2)]),
  [], ['ORÇAMENTOS APROVADOS'], ['Número', 'Cliente', 'Data', 'Valor (R$)', 'Lucro estimado (R$)'],
  ...quotes.filter(q => q.status === 'aprovado').map(q => [q.number, q.clientName, q.date, q.total.toFixed(2), q.netProfit.toFixed(2)])
], `financeiro_${today()}.csv`);

export const exportClientsToCSV = (clients: Client[]) => downloadCsv([
  ['Nome', 'Telefone', 'Email', 'Documento', 'Cidade', 'Endereço', 'Observações'],
  ...clients.map(c => [c.name, c.phone, c.email, c.document ?? '', c.city ?? '', c.address ?? '', c.notes ?? ''])
], `clientes_${today()}.csv`);
