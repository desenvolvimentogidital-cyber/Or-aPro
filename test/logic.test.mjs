import test from 'node:test';
import assert from 'node:assert/strict';
import { pricingEstimate, quoteTotals, nextQuoteNumber, approvedRevenue, monthlyApprovedTotals, newId } from '../.test-dist/utils/quoteMath.js';
import { makeCsv } from '../.test-dist/utils/csvExport.js';

test('markup from costs, margin and tax, without fallback', () => {
  const v = pricingEstimate({ monthlyExpenses: 1760, workDays: 22, workHours: 176, margin: 25, tax: 5, material: 100, jobHours: 5, travel: 50 });
  assert.equal(v.costPerHour, 10);
  assert.equal(v.directCost, 200);
  assert.ok(Math.abs(v.price - 285.71428571) < 0.001);
  assert.ok(Math.abs(v.profit / v.price - 0.25) < 0.000001);
});

test('invalid markup input throws, not fake 1.35', () => {
  const v = { monthlyExpenses: 0, workDays: 22, workHours: 176, margin: 100, tax: 5, material: 0, jobHours: 0, travel: 0 };
  assert.throws(() => pricingEstimate(v), /inferior a 100/);
  assert.throws(() => pricingEstimate({ ...v, margin: 20, workHours: 0 }), /maiores que zero/);
  assert.throws(() => pricingEstimate({ ...v, margin: -1 }), /entre 0 e 100/);
});

test('quote calculations include travel, taxes and negative loss', () => {
  const q = quoteTotals({ items: [{ id: 'a', name: 'serviço', type: 'servico', quantity: 1, unit: 'un', unitPrice: 50, totalPrice: 50, unitCost: 80 }], travelCost: 10, discountType: 'fixed', discountValue: 0, taxRate: 10 });
  assert.equal(q.total, 60);
  assert.equal(q.netProfit, -36);
  assert.equal(q.missingCostCount, 0);
});

test('invalid discounts rejected', () => {
  const v = { items: [], travelCost: 10, discountType: 'fixed', discountValue: 11, taxRate: 0 };
  assert.throws(() => quoteTotals(v), /desconto não pode/);
  assert.throws(() => quoteTotals({ ...v, discountType: 'percentage', discountValue: 120 }), /entre 0 e 100/);
});

test('sequential numbers survive deletions via persistent last-issued counter', () => {
  assert.equal(nextQuoteNumber([{ number: '#018' }, { number: '#007' }]), '#019');
  assert.equal(nextQuoteNumber([], 53), '#054');
});

test('approved revenue only in requested date range', () => {
  const data = [{ status: 'aprovado', date: '2026-10-04', total: 150 }, { status: 'rascunho', date: '2026-10-01', total: 999 }, { status: 'aprovado', date: '2026-09-01', total: 50 }];
  assert.equal(approvedRevenue(data, new Date(2026, 9, 1), new Date(2026, 10, 1)), 150);
});

test('CSV escapes formula injection, separators, quotes and preserves negative numbers', () => {
  const csv = makeCsv([['Name','Amount'], ['=HYPERLINK("https://evil")', -36], ['  +cmd','a;b"c']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes('"-36"'));
  assert.ok(csv.includes("'  +cmd"));
  assert.ok(csv.includes('"a;b""c"'));
});

test('new IDs are unique', () => assert.notEqual(newId('orc'), newId('orc')));

test('revenue sparkline uses real approved monthly values', () => {
  const values = monthlyApprovedTotals([{ status: 'aprovado', date: '2026-10-01', total: 150 }, { status: 'recusado', date: '2026-09-01', total: 700 }], 2, new Date(2026, 9, 8));
  assert.deepEqual(values, [0, 150]);
});
