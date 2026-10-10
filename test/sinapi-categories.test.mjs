import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOfSinapi,matchesSinapiCategory,categoryLabel} from '../.test-dist/utils/sinapiCategories.js';
import {simulateCrewForQuote} from '../.test-dist/utils/quoteSchedule.js';
import {estimateSchedule} from '../.test-dist/utils/scheduleMath.js';
import {buildScheduleDocument} from '../.test-dist/utils/scheduleDocument.js';

const comp=(code,description,labor)=>({
  code,description,unit:'UN',sourceFile:'SINAPI QA',sourceSheet:'Analítico',
  reference:'09/2026',labor:labor.map(([code,role,hoursPerUnit])=>({code,role,hoursPerUnit}))
});
const plumbing=comp('100860','CHUVEIRO ELÉTRICO, FORNECIMENTO E INSTALAÇÃO',[
  ['88316','SERVENTE COM ENCARGOS COMPLEMENTARES',0.4535436],
  ['88267','ENCANADOR OU BOMBEIRO HIDRÁULICO COM ENCARGOS COMPLEMENTARES',1.1816004]
]);
const electric=comp('91991','TOMADA ALTA DE EMBUTIR 20 A',[
  ['88264','ELETRICISTA COM ENCARGOS COMPLEMENTARES',0.7],
  ['88247','AUXILIAR DE ELETRICISTA COM ENCARGOS COMPLEMENTARES',0.4]
]);
const mixed=comp('104827','PAINEL COM TOMADAS E SAÍDAS DE GASES',[
  ['88264','ELETRICISTA COM ENCARGOS COMPLEMENTARES',0.4],
  ['88267','ENCANADOR OU BOMBEIRO HIDRÁULICO COM ENCARGOS COMPLEMENTARES',0.3]
]);

test('chuveiro SINAPI 100860 é hidráulico porque tem encanador, não eletricista',()=>{
  assert.equal(categoryOfSinapi(plumbing),'hidraulica');
  assert.equal(matchesSinapiCategory(plumbing,'eletrica'),false);
  assert.equal(matchesSinapiCategory(plumbing,'hidraulica'),true);
  assert.equal(matchesSinapiCategory(electric,'eletrica'),true);
  assert.equal(matchesSinapiCategory(electric,'hidraulica'),false);
});

test('etapa mista mantém ambas as profissões e não pode ser filtrada como apenas elétrica',()=>{
  assert.equal(categoryOfSinapi(mixed),'mista');
  assert.equal(matchesSinapiCategory(mixed,'eletrica'),false);
  assert.equal(matchesSinapiCategory(mixed,'hidraulica'),false);
  assert.equal(matchesSinapiCategory(mixed,'mista'),true);
  assert.equal(simulateCrewForQuote(mixed,10,8,1).labor.length,2);
});

test('instalação elétrica pendente após hidráulica pronta dimensiona só as funções elétricas da composição escolhida',()=>{
  const sizing=simulateCrewForQuote(electric,22,8,1,2);
  assert.equal(sizing.totalHH,24.2);
  assert.deepEqual(Object.keys(sizing.crew).sort(),[
    '88247:AUXILIAR DE ELETRICISTA COM ENCARGOS COMPLEMENTARES',
    '88264:ELETRICISTA COM ENCARGOS COMPLEMENTARES'
  ]);
  assert.equal(sizing.projectedDays,2);
  const schedule={id:'cat-test',title:'Instalação elétrica pendente',startDate:'2026-10-12',
    hoursPerDay:8,efficiency:1,tasks:[{id:'eletrica',composition:electric,quantity:22,crew:sizing.crew}]};
  const result=estimateSchedule(schedule);
  assert.equal(result.totalHH,24.2);
  assert.equal(result.entries[0].days,2);
  assert.ok(result.entries[0].labor.every(l=>!l.role.includes('ENCANADOR')));
  const html=buildScheduleDocument(schedule);
  assert.match(html,/Resumo de HH por especialidade/);
  assert.match(html,/Elétrica \(sem encanador\)/);
  assert.match(html,/Especialidade:/);
  assert.match(categoryLabel(plumbing),/Hidráulica/);
});

test('serviço sem profissão verificada não é automaticamente considerado elétrico',()=>{
  const unknown=comp('999001','INSTALAÇÃO ELÉTRICA',[]);
  assert.equal(categoryOfSinapi(unknown),'outras');
  assert.equal(matchesSinapiCategory(unknown,'eletrica'),false);
  assert.equal(matchesSinapiCategory(plumbing,'todas'),true);
});
