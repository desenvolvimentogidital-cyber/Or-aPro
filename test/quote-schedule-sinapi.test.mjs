import test from 'node:test';
import assert from 'node:assert/strict';
import {sameServiceUnit,findQuoteSinapiCandidates,simulateCrewForQuote} from '../.test-dist/utils/quoteSchedule.js';
import {estimateSchedule} from '../.test-dist/utils/scheduleMath.js';
import {physicalFinancial} from '../.test-dist/utils/physicalFinancial.js';

const make = (code, description, unit, labor) => ({
  code,description,unit, labor:labor.map(([c,r,h])=>({code:c,role:r,hoursPerUnit:h})),
  sourceFile:'SINAPI QA - valores inventados só para teste',sourceSheet:'Analitico'
});
const samples=[
  make('100001','Alvenaria de vedação com blocos de concreto','m²',[['01','Pedreiro',0.5],['02','Servente',0.25]]),
  make('100002','Cerâmica para piso assentada argamassa','m²',[['03','Azulejista',0.4],['02','Servente',0.2]]),
  make('100003','Piso porcelanato assentado','M2',[['03','Azulejista',0.6],['02','Servente',0.3]]),
  make('100004','Divisória de drywall chapas de gesso','m²',[['04','Montador',0.3],['02','Servente',0.1]]),
  make('100005','Pintura acrílica paredes duas demãos','m²',[['05','Pintor',0.1],['02','Servente',0.05]]),
  make('100006','Pintura esmalte sobre madeira','m²',[['05','Pintor',0.2]]),
  make('100007','Alvenaria de vedação em tijolo cerâmico','m³',[['01','Pedreiro',0.9]])
];

test('unidades equivalentes m²/M2 são aceitas, m³ é outra grandeza',()=>{
  assert.ok(sameServiceUnit('m²','M2'));
  assert.ok(sameServiceUnit(' M ² ','M2'));
  assert.equal(sameServiceUnit('m²','m³'),false);
  assert.equal(sameServiceUnit('m2','m'),false);
});

test('orçamento sugere alvenaria, porcelanato, drywall e pintura SOMENTE na unidade correta',()=>{
  for(const [name,code] of [
    ['Alvenaria de vedação com blocos', '100001'],
    ['500 m² de porcelanato', '100003'],
    ['250 m² de drywall', '100004'],
    ['600 m² pintura acrílica', '100005']
  ]){
    const rows=findQuoteSinapiCandidates({name,unit:'M2'},samples);
    assert.ok(rows.some(c=>c.code===code),name);
    assert.ok(rows.every(c=>sameServiceUnit(c.unit,'m²')));
  }
  assert.equal(findQuoteSinapiCandidates({name:'Alvenaria',unit:'m³'},samples)[0].code,'100007');
});

test('seleção por código exato supera palavras coincidentes e busca manual funciona',()=>{
  assert.equal(findQuoteSinapiCandidates({name:'Composição SINAPI 100006 pintura',unit:'m²'},samples)[0].code,'100006');
  assert.equal(findQuoteSinapiCandidates({name:'Revestimento de banheiro',unit:'m²'},samples).length,0);
  assert.equal(findQuoteSinapiCandidates({name:'Revestimento de banheiro',unit:'m²'},samples,'porcelanato')[0].code,'100003');
  assert.equal(findQuoteSinapiCandidates({name:'Drywall',unit:'m³'},samples).length,0);
});

test('prazo informado simula trabalhadores por profissão, nunca multiplica horas-homem duas vezes',()=>{
  const example=simulateCrewForQuote(samples[2],500,8,0.8,10);
  assert.equal(example.totalHH,450);
  assert.deepEqual(example.crew,{'03:Azulejista':5,'02:Servente':3});
  assert.equal(example.projectedDays,10);
  assert.equal(example.labor[0].coefficient,0.6);
  assert.equal(example.labor[0].hours,300);
});

test('sem prazo usa cenário declarado de uma pessoa por função, sem inventar efetivo',()=>{
  const example=simulateCrewForQuote(samples[3],250,8,0.8);
  assert.equal(example.totalHH,100);
  assert.equal(example.projectedDays,12);
  assert.deepEqual(example.crew,{'04:Montador':1,'02:Servente':1});
  assert.equal(example.targetDays,null);
});

test('recusa prazo, coeficientes e quantitativos inválidos',()=>{
  for(const days of [0,-1,1.5,10001,NaN])assert.throws(()=>simulateCrewForQuote(samples[0],100,8,0.8,days));
  assert.throws(()=>simulateCrewForQuote(samples[0],100,8,0,5));
  assert.throws(()=>simulateCrewForQuote(samples[0],-5,8,1,5));
  assert.throws(()=>simulateCrewForQuote(samples[0],1000000,8,1,1),/500/);
  assert.throws(()=>simulateCrewForQuote(make('1','Invalido','m²',[['0','Pedreiro',0]]),100,8,1));
});

test('equipe sugerida comunica com estimativa e financeiro por ID de item',()=>{
  const comp=samples[0],item={id:'item-alvenaria',name:'Alvenaria',unit:'m²',quantity:100,unitPrice:80,totalPrice:8000};
  const crew=simulateCrewForQuote(comp,item.quantity,8,0.8,6);
  const task={id:'etapa-alvenaria',quoteItemId:item.id,composition:comp,quantity:item.quantity,crew:crew.crew,progress:[]};
  const plan={id:'qa-plan',startDate:'2026-10-19',hoursPerDay:8,efficiency:0.8,tasks:[task],title:'QA',createdAt:'x',updatedAt:'x'};
  const estimate=estimateSchedule(plan);
  assert.equal(estimate.pending,0);
  assert.equal(estimate.entries[0].days,5);
  assert.equal(estimate.entries[0].totalHH,75);
  const financial=physicalFinancial(plan,{items:[item]});
  assert.equal(financial.unlinkedTasks,0);
  assert.equal(financial.uncoveredItems,0);
  assert.equal(financial.planned,8000);
  assert.equal(financial.measured,0);
});
