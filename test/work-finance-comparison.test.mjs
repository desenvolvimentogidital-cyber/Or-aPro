import test from 'node:test';
import assert from 'node:assert/strict';
import {compareWorkFinance,financialWorkQuoteId} from '../.test-dist/utils/workFinanceComparison.js';
const task={id:'t',composition:{code:'88309',unit:'M2',description:'Tarefa',labor:[],sourceFile:'',sourceSheet:''},quantity:10,crew:{}};
const schedule=(id,quoteId)=>({id,title:'Obra '+id,quoteId,startDate:'2026-10-11',
  hoursPerDay:8,efficiency:1,tasks:[task],createdAt:'2026-10-11T00:00:00Z',
  updatedAt:'2026-10-11T00:00:00Z'});
const quote={
 id:'q',number:'#102',status:'aprovado',total:2000,items:[
  {id:'i1',name:'Material',quantity:10,unitCost:50,costConfirmed:true},
  {id:'i2',name:'Execução',quantity:1,unitCost:400,costConfirmed:true},
  {id:'i3',name:'Taxa sem custo confirmado',quantity:1,costConfirmed:false}
 ]};
const entry=(id,type,amount,options={})=>({
 id,type,amount,date:'2026-10-11',description:'Pagamento real',category:'Obra',
 createdAt:'2026-10-11T12:00:00Z',...options});
test('separa despesa REAL da obra, custos unitários conhecidos e orçamento de venda',()=>{
 const work=schedule('s1','q');
 const r=compareWorkFinance([work],[quote],[
  entry('1','recebimento',1000,{scheduleId:'s1',quoteId:'q'}),
  entry('2','despesa',240,{scheduleId:'s1',quoteId:'q'}),
  entry('3','despesa',50,{quoteId:'q'}),
  entry('4','despesa',90)
 ]);
 assert.equal(r.projects[0].plannedSale,2000);
 assert.equal(r.projects[0].directCostKnown,900);
 assert.equal(r.projects[0].directCostMissingItems,1);
 assert.equal(r.projects[0].actualSpent,240);
 assert.equal(r.projects[0].actualReceived,1000);
 assert.equal(r.projects[0].actualCashBalance,760);
 assert.equal(r.projects[0].unassignedQuoteMovements,1);
 assert.equal(r.unlinkedSpent,140);
});
test('dois cronogramas com mesma proposta não duplicam um pagamento sem obra',()=>{
 const r=compareWorkFinance([schedule('s1','q'),schedule('s2','q')],[quote],[
  entry('a','despesa',800,{quoteId:'q'}),
  entry('b','despesa',100,{scheduleId:'s2',quoteId:'q'})]);
 assert.equal(r.projects[0].actualSpent,0);
 assert.equal(r.projects[1].actualSpent,100);
 assert.equal(r.unlinkedSpent,800);
});
test('não inventa custos nem valores de venda em obra sem proposta',()=>{
 const r=compareWorkFinance([schedule('s1')],[],[entry('a','despesa',30,{scheduleId:'s1'})]);
 assert.equal(r.projects[0].plannedSale,null);
 assert.equal(r.projects[0].directCostKnown,0);
 assert.equal(r.projects[0].directCostMissingItems,0);
 assert.equal(r.projects[0].actualSpent,30);
});
test('bloqueia orçamento divergente da obra e aceita lançamento geral legado',()=>{
 const ss=[schedule('s1','q')];
 assert.deepEqual(financialWorkQuoteId('s1','',ss),{scheduleId:'s1',quoteId:'q'});
 assert.deepEqual(financialWorkQuoteId('','q',ss),{quoteId:'q'});
 assert.throws(()=>financialWorkQuoteId('s1','other',ss),/não corresponde/);
 assert.throws(()=>financialWorkQuoteId('unknown','',ss),/não encontrada/);
});
test('lançamentos com valor inválido não contaminam o confronto',()=>{
 const r=compareWorkFinance([schedule('s1')],[],[
  entry('bad','despesa',NaN,{scheduleId:'s1'}),
  entry('yes','despesa',100,{scheduleId:'s1'})]);
 assert.equal(r.projects[0].actualSpent,100);
 assert.equal(r.invalidEntries,1);
});

test('custo direto ignora quantidades inválidas, produtos infinitos e preserva custo zero confirmado',()=>{
 const badQuote={...quote,items:[
  {...quote.items[0],id:'ok',quantity:2,unitCost:10,costConfirmed:true},
  {...quote.items[0],id:'no-number',quantity:NaN,unitCost:10,costConfirmed:true},
  {...quote.items[0],id:'negative',quantity:-3,unitCost:20,costConfirmed:true},
  {...quote.items[0],id:'infinite-product',quantity:1e308,unitCost:1e308,costConfirmed:true},
  {...quote.items[0],id:'zero-confirmed',quantity:1,unitCost:0,costConfirmed:true}
 ]};
 const r=compareWorkFinance([schedule('s1','q')],[badQuote],[]);
 assert.equal(r.projects[0].directCostKnown,20);
 assert.equal(r.projects[0].directCostMissingItems,3);
 assert.equal(r.projects[0].directCostCoveredItems,2);
 assert.ok(Number.isFinite(r.projects[0].directCostKnown));
});
