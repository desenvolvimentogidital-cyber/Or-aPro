import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSinapiUnitCosts } from '../.test-dist/utils/sinapiCosts.js';
import { buildQuoteDocument } from '../.test-dist/utils/quoteDocument.js';
import { financeMetrics } from '../.test-dist/utils/financeMetrics.js';

test('fluxo SINAPI custo -> orçamento de venda -> PDF -> caixa preserva a origem real', () => {
  const source = { uf: 'SP', reference: '08/2026', regime: 'sem_desoneracao' };
  const result = parseSinapiUnitCosts('Código composição;Descrição;Unidade;Custo unitário\n96113;Forro de gesso;m²;58,51\n', source);
  assert.equal(result.rows.length, 1);
  const item = result.rows[0];
  assert.equal(item.unitCost, 58.51);
  assert.equal(item.source.uf, 'SP');
  assert.equal('sellingPrice' in item, false, 'custo de referencia não pode virar venda automaticamente');

  const quote = {
    id:'qa-orc-1', number:'#QA-001', date:'2026-10-09', validUntil:'2026-11-09',
    clientId:'qa-cliente-1', clientName:'Cliente de integração', clientPhone:'', clientEmail:'',
    status:'aprovado', subtotal:3200, total:3200, travelCost:0, otherCosts:0,
    discountType:'fixed', discountValue:0, taxRate:0, targetMarginRate:0,
    netProfit:3200-40*item.unitCost, modelTemplate:'padrao',
    items:[{id:'qa-item-1', name:item.description, type:'servico', unit:item.unit, quantity:40, unitPrice:80, totalPrice:3200}]
  };
  const company = { name:'Empresa QA', tradeName:'Empresa QA', phone:'',email:'', pixKey:'',document:'',address:'',city:'',state:'' };
  const html = buildQuoteDocument({quote,company});
  assert.match(html,/Forro de gesso/);
  assert.match(html,/R\$\s*3\.200,00/);
  assert.doesNotMatch(html,/R\$\s*58,51/, 'custo da referência não deve aparecer como preço de venda');
  const transactions = [
    {id:'qa-receb-1',date:'2026-10-09',createdAt:'2026-10-09T10:00:00Z',description:'Recebimento informado',category:'Projeto',type:'recebimento',amount:1000,quoteId:quote.id},
    {id:'qa-desp-1',date:'2026-10-09',createdAt:'2026-10-09T10:00:00Z',description:'Despesa informada',category:'Projeto',type:'despesa',amount:500,quoteId:quote.id}
  ];
  const metrics=financeMetrics(transactions,[quote]);
  assert.equal(metrics.approvedValue,3200);
  assert.equal(metrics.received,1000);
  assert.equal(metrics.spent,500);
  assert.equal(metrics.cashBalance,500);
  assert.equal(metrics.receivable,2200);
  assert.equal(metrics.invalidEntries,0);
});
