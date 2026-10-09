import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardSummary, dashboardBounds, dashboardMonthlySeries, quoteEstimatedProfit, approvalDate, recentlyChangedQuotes } from '../.test-dist/utils/dashboardMetrics.js';

const today = new Date(2026, 9, 8);
const item = (unitCost = 40) => ({id:'item-1', name:'Serviço cadastrado', unit:'un', type:'servico', quantity:2, unitPrice:100, totalPrice:200, unitCost});
const quote = (id,status, date='2026-10-01', overrides={}) => ({id,status,date,total:210,items:[item()],taxRate:10,travelCost:10,otherCosts:0,history:[],...overrides});

test('sem registros reais, painel fica zerado e sem taxa fictícia', () => {
  const result = dashboardSummary([], 'mes', today);
  assert.equal(result.issuedValue, 0);
  assert.equal(result.approvedValue, 0);
  assert.equal(result.awaitingValue, 0);
  assert.equal(result.estimatedProfit, 0);
  assert.equal(result.approvalRate, null);
  assert.deepEqual(dashboardMonthlySeries([], 3, today).map(m=>m.approved),[0,0,0]);
});

test('enviado é pendente; rascunho não é emitido nem pendente', () => {
  const data = [quote('pending','enviado'),quote('draft','rascunho')];
  const result = dashboardSummary(data, 'mes', today);
  assert.equal(result.awaitingCount, 1);
  assert.equal(result.awaitingValue, 210);
  assert.equal(result.totalQuotes,2);
  assert.equal(result.issuedCount,1);
  assert.equal(result.approvalRate,null);
});

test('aprovação registrada em outubro de proposta de setembro conta na aprovação de outubro', () => {
  const older = quote('approved','aprovado','2026-09-05', {history:[{date:'2026-10-05T10:00:00.000Z',action:'Status alterado manualmente para aprovado',user:'Responsável'}]});
  assert.equal(approvalDate(older),'2026-10-05');
  const result = dashboardSummary([older], 'mes',today);
  assert.equal(result.issuedValue,0);
  assert.equal(result.approvedCount,1);
  assert.equal(result.approvedValue,210);
  assert.equal(result.estimatedProfit,99); // 210 - 80 (itens) - 10 (deslocamento) - 21 (imposto)
});

test('marcação de aprovação por link entra no mês de aceite', () => {
  const viaLink = quote('approved','aprovado','2026-08-12', {history:[{date:'2026-10-07T13:30:00.000Z',action:'Resposta registrada no link público: aprovado (identidade não verificada)',user:'Visitante'}]});
  assert.equal(approvalDate(viaLink),'2026-10-07');
  assert.equal(dashboardSummary([viaLink],'mes',today).approvedValue,210);
});

test('sem custo cadastrado, não inventa lucro e sinaliza incompletude', () => {
  const data=[quote('unknown','aprovado','2026-10-02',{items:[{...item(),unitCost:undefined}]}),quote('known','aprovado')];
  const result=dashboardSummary(data,'mes',today);
  assert.equal(result.profitComplete,false);
  assert.equal(result.incompleteProfitCount,1);
  assert.equal(result.estimatedProfit,99); // apenas a parte apurável; UI oculta o total enquanto incompleto
  assert.equal(quoteEstimatedProfit(data[0]),null);
});

test('prejuízo é preservado; não substitui negativo por zero', () => {
  const negative = quote('loss','aprovado','2026-10-02',{items:[item(150)]});
  const result=dashboardSummary([negative],'mes',today);
  assert.equal(result.estimatedProfit,-121);
  assert.equal(result.profitComplete,true);
});

test('gráfico mensal agrega valores reais, sem inventar dados', () => {
  const data=[quote('july','aprovado','2026-09-20',{history:[{date:'2026-10-06T15:00:00Z',action:'Status alterado manualmente para aprovado',user:'a'}]}),quote('sent','enviado','2026-10-05'),quote('draft','rascunho','2026-10-05')];
  const series=dashboardMonthlySeries(data,2,today);
  assert.deepEqual(series.map(x=>x.month),['2026-09','2026-10']);
  assert.equal(series[0].issued,210);
  assert.equal(series[1].issued,210);
  assert.equal(series[1].approved,210);
  assert.equal(series[1].awaiting,210);
});

test('períodos contemplam virada do ano e ordenação recente não altera estado', () => {
  assert.deepEqual(dashboardBounds('trimestre',new Date(2026,0,8)),{start:'2025-11-01',end:'2026-02-01'});
  const quotes=[quote('old','enviado','2026-09-01'),quote('new','aprovado','2026-09-01',{history:[{date:'2026-10-04T12:00:00Z',action:'Status alterado manualmente para aprovado',user:'a'}]})];
  assert.equal(recentlyChangedQuotes(quotes,1)[0].id,'new');
  assert.equal(quotes[0].id,'old');
});

test('custo zero só é real quando confirmado; legado ambíguo fica em revisão', () => {
  const oldData=quote('old','aprovado','2026-10-01',{items:[{...item(0)}]});
  const confirmed=quote('new','aprovado','2026-10-01',{items:[{...item(0),costConfirmed:true}]});
  assert.equal(quoteEstimatedProfit(oldData),null);
  assert.equal(quoteEstimatedProfit(confirmed),179);
  const result=dashboardSummary([oldData,confirmed],'mes',today);
  assert.equal(result.incompleteProfitCount,1);
});
