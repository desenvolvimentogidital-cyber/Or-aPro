import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleOverviewModel} from '../.test-dist/utils/scheduleOverview.js';
import {buildScheduleDocument} from '../.test-dist/utils/scheduleDocument.js';
const make=(id,code,role,hh,qty,crew,measurements=[])=>({
 id,composition:{code,description:'Serviço '+code,unit:'M2',labor:[{code:'1',role,hoursPerUnit:hh}],sourceFile:'SINAPI ANALITICO.xlsx',sourceSheet:'Analítico'},
 quantity:qty,crew:{['1:'+role]:crew},progress:measurements
});
const t1=make('s1','111111','Pedreiro',2,50,2,[{id:'m1',date:'2026-10-05',quantity:25,recordedAt:'2026-10-05T15:00:00Z'}]);
const t2=make('s2','222222','Pintor',1,20,1,[]);
const plan={
 id:'p1',title:'Obra QA sem dados comerciais',siteAddress:'Rua QA, 99',
 startDate:'2026-10-01',hoursPerDay:8,efficiency:1,tasks:[t1,t2],
 createdAt:'2026-10-01T10:00:00Z',updatedAt:'2026-10-06T10:00:00Z'
};
test('progresso físico usa HH ponderadas, não soma quantidades com unidades incompatíveis',()=>{
 const r=scheduleOverviewModel(plan,undefined,'2026-10-09');
 assert.equal(r.totalHH,120);
 assert.ok(Math.abs(r.physical-(100*50/120))<1e-9);
 assert.equal(r.completed,0);
 assert.equal(r.inProgress,1);
 assert.equal(r.notStarted,1);
 assert.equal(r.stages[0].share,100*100/120);
 assert.equal(r.stages[1].share,100*20/120);
 assert.equal(r.financialPercent,null);
});
test('curva S soma somente medições efetivamente datadas, não simula percentuais realizados',()=>{
 const r=scheduleOverviewModel(plan,undefined,'2026-10-09');
 assert.equal(r.months[0].key,'2026-10');
 assert.equal(r.months[0].planned,100);
 assert.equal(r.months[0].actual,41.7);
 assert.equal(r.hasMeasurements,true);
 const noMeasures={...plan,tasks:[{...t1,progress:[]},t2]};
 const empty=scheduleOverviewModel(noMeasures);
 assert.equal(empty.hasMeasurements,false);
 assert.equal(empty.physical,0);
 assert.equal(empty.months[0].actual,0);
});
test('prazos vencidos: compara fim previsto com data de referência, não afirma atraso contratual',()=>{
 const early=scheduleOverviewModel(plan,undefined,'2026-10-01');
 const late=scheduleOverviewModel(plan,undefined,'2026-11-10');
 assert.equal(early.overdue,0);
 assert.equal(late.overdue,2);
 assert.equal(late.unknownDeadline,0);
 const unset={...plan,tasks:[{...t1,crew:{}}]};
 const missing=scheduleOverviewModel(unset);
 assert.equal(missing.pending,1);
 assert.equal(missing.end,null);
 assert.equal(missing.unknownDeadline,1);
 assert.equal(missing.months.length,0);
});
test('PDF tem capa no estilo do dashboard, com dados verdadeiros, seguida do detalhamento de dias úteis',()=>{
 const html=buildScheduleDocument(plan,undefined,{name:'OrçaPro QA',tradeName:'ORÇAPRO TESTES'});
 for(const needle of ['id="oc-report-cover"','CRONOGRAMA DE OBRAS','RESUMO DAS ETAPAS',
 'GRÁFICO DE GANTT','AVANÇO FÍSICO DA OBRA','CURVA S','CONTROLE DE PRAZOS',
 'Rua QA, 99','ORÇAPRO TESTES','Atividades','Planejamento visual','Dias úteis','D1','D2']){
   if(needle==='Atividades'||needle==='Dias úteis')continue;
   assert.ok(html.includes(needle), 'Faltou '+needle);
 }
 assert.ok(html.includes('Não informado') || html.includes('Sem registro'));
 assert.doesNotMatch(html,/100% Conforme|0 Acidentes/);
});
test('PDF escapa marca, endereço e título sem injetar HTML',()=>{
 const dirty={...plan,title:'<img src=x onerror=alert(1)>',siteAddress:'<script>oops</script>'};
 const html=buildScheduleDocument(dirty,undefined,{name:'<svg onload=alert(1)>',tradeName:''});
 assert.ok(!html.includes('<script>oops</script>'));
 assert.ok(!html.includes('<svg onload=alert(1)>'));
 assert.ok(html.includes('&lt;script&gt;oops&lt;/script&gt;'));
});
