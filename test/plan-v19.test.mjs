import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateSchedule, nextWorkday, advanceWorkdays, workingDaysBetween} from '../.test-dist/utils/scheduleMath.js';
import {physicalFinancial} from '../.test-dist/utils/physicalFinancial.js';
const comp = (code='S1')=>({code,description:'Serviço de teste sem produtividade incorporada',unit:'M2',labor:[{code:'88309',role:'Pedreiro',hoursPerUnit:1}],sourceFile:'coeficientes fornecidos',sourceSheet:'Analítico'});
const task = (id,dependencies,quantity=16)=>({id,composition:comp(id),quantity,crew:{'88309:Pedreiro':1},dependencies,progress:[]});
const plan = (tasks,extras={})=>({id:'plan',title:'Teste de regras',startDate:'2026-10-09',hoursPerDay:8,efficiency:1,tasks,...extras});
const item=(id,unit='M2',quantity=16,totalPrice=800)=>({id,unit,quantity,totalPrice,name:id,type:'servico'});
const quote=(items,status='aprovado')=>({id:'q',number:'#001',status,items});

test('planos antigos continuam sequenciais sem migração destrutiva',()=>{
  const p=plan([task('a'),task('b')]);
  const r=estimateSchedule(p);
  assert.equal(r.entries[0].start,'2026-10-09');
  assert.equal(r.entries[1].start,'2026-10-13');
  assert.equal(r.finishDate,'2026-10-14');
  assert.equal(r.workingDays,4);
});
test('tarefas independentes executam em paralelo',()=>{
  const p=plan([task('a',[]),task('b',[])],{scheduleMode:'dependencias'});
  const r=estimateSchedule(p);
  assert.equal(r.entries[0].start,r.entries[1].start);
  assert.equal(r.finishDate,'2026-10-12');
  assert.equal(r.workingDays,2);
});
test('dependência encadeada inicia no dia útil seguinte',()=>{
  const p=plan([task('a',[]),task('b',['a']),task('c',['b'])],{scheduleMode:'dependencias'});
  const r=estimateSchedule(p);
  assert.equal(r.entries[1].start,'2026-10-13');
  assert.equal(r.entries[2].start,'2026-10-15');
  assert.equal(r.workingDays,6);
});
test('feriados informados excluídos do cálculo sem buscar feriados inventados',()=>{
  const p=plan([task('a',[])],{holidays:['2026-10-12'],scheduleMode:'dependencias'});
  const r=estimateSchedule(p);
  assert.equal(r.entries[0].end,'2026-10-13');
  assert.equal(advanceWorkdays('2026-10-09',2,['2026-10-12']),'2026-10-13');
  assert.equal(workingDaysBetween('2026-10-09','2026-10-13',['2026-10-12']),2);
});
test('ciclo A→B→A bloqueia todas as datas afetadas',()=>{
  const r=estimateSchedule(plan([task('a',['b']),task('b',['a'])],{scheduleMode:'dependencias'}));
  assert.equal(r.pending,2);assert.equal(r.finishDate,null);
  assert.ok(r.entries.every(e=>e.start===null&&e.warnings.length));
});
test('dependência inexistente bloqueia prazo, sem estimativa arbitrária',()=>{
  const r=estimateSchedule(plan([task('a',['fantasma'])],{scheduleMode:'dependencias'}));
  assert.equal(r.workingDays,null);
  assert.match(r.entries[0].warnings.join(' '),/Dependência inválida/);
});
test('planos com dia não útil inválido não inventam datas',()=>{
  const r=estimateSchedule(plan([task('a',[])],{holidays:['2026-02-30'],scheduleMode:'dependencias'}));
  assert.equal(r.workingDays,null);
});
test('valor financeiro apenas sobre item vinculado e quantitativo compatível',()=>{
  const a={...task('a',[],16),quoteItemId:'i1',progress:[{id:'p',date:'2026-10-10',quantity:8,recordedAt:'2026-10-10T12:00:00Z'}]};
  const p=plan([a,task('b',[])],{quoteId:'q'});
  const r=physicalFinancial(p,quote([item('i1'),item('i2')]));
  assert.equal(r.planned,800);assert.equal(r.measured,400);assert.equal(r.percent,50);
  assert.equal(r.unlinkedTasks,1);assert.equal(r.uncoveredItems,1);
});
test('não contabilizar duas vezes o mesmo item do orçamento',()=>{
  const p=plan([{...task('a',[]),quoteItemId:'i1'},{...task('b',[]),quoteItemId:'i1'}]);
  const r=physicalFinancial(p,quote([item('i1')]));
  assert.equal(r.planned,800);assert.equal(r.linked.length,1);
  assert.match(r.issues.join(' '),/mais de uma etapa/);
});
test('unidade e quantitativo incompatíveis bloqueiam financeiro proporcional',()=>{
  const p=plan([{...task('a',[]),quoteItemId:'i1'}]);
  assert.equal(physicalFinancial(p,quote([item('i1','M3')])).planned,0);
  assert.equal(physicalFinancial(p,quote([item('i1','M2',17)])).planned,0);
});
test('orçamento inexistente ou não vinculado não produz valor imaginário',()=>{
  assert.equal(physicalFinancial(plan([task('a',[])]),undefined).percent,null);
});
