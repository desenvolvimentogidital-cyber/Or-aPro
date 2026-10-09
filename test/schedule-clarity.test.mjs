import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSchedule, scheduleWorkdayDates, workingDaysBetween } from '../.test-dist/utils/scheduleMath.js';
import { buildScheduleDocument } from '../.test-dist/utils/scheduleDocument.js';

const composition = {
  code:'104658', description:'Piso podotátil de alerta ou direcional, assentado sobre argamassa',
  unit:'M2', sourceFile:'SINAPI_Referência_2026_08.xlsx', sourceSheet:'Analítico',
  reference:'08/2026', uf:'SP',regime:'sem_desoneracao',
  labor:[{code:'88316',role:'SERVENTE COM ENCARGOS COMPLEMENTARES',hoursPerUnit:1.279},
         {code:'88309',role:'PEDREIRO COM ENCARGOS COMPLEMENTARES',hoursPerUnit:.639}]
};
const crew={'88316:SERVENTE COM ENCARGOS COMPLEMENTARES':2,'88309:PEDREIRO COM ENCARGOS COMPLEMENTARES':1};
const makeTask=(id,quantity,dependencies=[])=>({id,composition,quantity,crew,dependencies,progress:[]});
const plan = {
  id:'qa',title:'AMOSTRA QA — Cronograma de obra',startDate:'2026-10-09',hoursPerDay:8,
  efficiency:1,holidays:['2026-10-12'],scheduleMode:'sequencial',
  tasks:[makeTask('t1',25),makeTask('t2',10)],
  createdAt:'2026-10-09T12:00:00Z',updatedAt:'2026-10-09T12:00:00Z'
};

test('escala usa datas concretas e pula fim de semana e feriado indicado',()=>{
  const days=scheduleWorkdayDates('2026-10-09','2026-10-16',['2026-10-12']);
  assert.deepEqual(days,['2026-10-09','2026-10-13','2026-10-14','2026-10-15','2026-10-16']);
  assert.equal(workingDaysBetween('2026-10-09','2026-10-16',['2026-10-12']),days.length);
});
test('cálculo por gargalo de profissão confere com HH reais por unidade',()=>{
  const report=estimateSchedule(plan);
  assert.ok(Math.abs(report.entries[0].totalHH-47.95)<1e-8);
  assert.equal(report.entries[0].days,2);
  assert.equal(report.entries[0].start,'2026-10-09');
  assert.equal(report.entries[0].end,'2026-10-13');
  assert.equal(report.entries[1].start,'2026-10-14');
  assert.equal(report.entries[1].end,'2026-10-14');
  assert.equal(report.workingDays,3);
  assert.equal(report.finishDate,'2026-10-14');
});
test('datas e duração legíveis aparecem no PDF para cliente',()=>{
  const html=buildScheduleDocument(plan);
  for(const expected of ['Dia útil','09/10','13/10','14/10','D1','D2','D3','2 dias úteis','1 dias úteis','104658','08/2026']){
    assert.ok(html.includes(expected),'Documento sem '+expected);
  }
  assert.match(html,/@page\{size:A4 landscape/);
  assert.match(html,/Planejamento visual · dias úteis 1 a 3/);
});
test('etapa sem equipe nunca recebe datas ou faixa inventadas',()=>{
  const missing={...plan,tasks:[{...makeTask('missing',25),crew:{}}]};
  const result=estimateSchedule(missing);
  assert.equal(result.finishDate,null);
  assert.equal(result.entries[0].days,null);
  const html=buildScheduleDocument(missing);
  assert.match(html,/Pendente/);
  assert.doesNotMatch(html,/Planejamento visual · dias úteis 1 a/);
});
test('etapas paralelas usam mesmo calendário',()=>{
  const parallel={...plan,scheduleMode:'dependencias',tasks:[makeTask('a',25),makeTask('b',10)]};
  const r=estimateSchedule(parallel);
  assert.equal(r.entries[0].start,'2026-10-09');
  assert.equal(r.entries[1].start,'2026-10-09');
  assert.equal(r.workingDays,2);
  assert.equal(r.finishDate,'2026-10-13');
});
test('datas inválidas não criam eixo visual',()=>{
  assert.deepEqual(scheduleWorkdayDates('2026-02-30','2026-03-10'),[]);
  assert.deepEqual(scheduleWorkdayDates('2026-10-15','2026-10-01'),[]);
});
