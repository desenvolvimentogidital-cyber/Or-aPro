import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateSchedule} from '../.test-dist/utils/scheduleMath.js';
import {estimateWorkCrewCosts,employeeMatchesLabor,setTaskCrewEmployee,roleKey}
 from '../.test-dist/utils/scheduleCrewCosts.js';
const electricianRole='ELETRICISTA COM ENCARGOS COMPLEMENTARES';
const labor=[{code:'88264',role:electricianRole,hoursPerUnit:1.5}];
const key=roleKey('88264',electricianRole);
const company=[
  {id:'hour',name:'Eletricista horista',sinapiCode:'88264',role:electricianRole,
   paymentBasis:'hourly',paymentAmount:42,monthlyExtras:150,plannedHoursPerMonth:60},
  {id:'month',name:'Eletricista mensal',sinapiCode:'88264',role:electricianRole,
   paymentBasis:'monthly',paymentAmount:4400,monthlyExtras:350,plannedHoursPerMonth:0},
  {id:'painter',name:'Pintor',sinapiCode:'88310',role:'PINTOR COM ENCARGOS COMPLEMENTARES',
   paymentBasis:'monthly',paymentAmount:3000,monthlyExtras:0,plannedHoursPerMonth:0}
];
const baseTask=(id='step',quantity=10,crew=2)=>({
  id,composition:{code:'91991',description:'Instalação elétrica',unit:'UN',
    reference:'09/2026',uf:'PR',regime:'com_desoneracao',
    sourceFile:'SINAPI',sourceSheet:'Analítico',labor},quantity,
  crew:{[key]:crew},employeeAssignments:{}
});
const build=(tasks)=>({
  id:'work',title:'Obra',startDate:'2026-10-12',
  hoursPerDay:8,efficiency:1,tasks,createdAt:'2026-10-12T00:00:00Z',
  updatedAt:'2026-10-12T00:00:00Z'
});
function forecast(tasks,days=22,hours=8){
 const plan=build(tasks);
 return estimateWorkCrewCosts(plan,estimateSchedule(plan),company,days,hours);
}
test('assigns only matching profession, never invents crew or extra people',()=>{
 const initial=baseTask();
 assert.equal(employeeMatchesLabor(company[0],'88264',electricianRole),true);
 assert.equal(employeeMatchesLabor(company[2],'88264',electricianRole),false);
 assert.throws(()=>setTaskCrewEmployee(initial,key,'painter',true,company),/profissão/);
 assert.throws(()=>setTaskCrewEmployee(baseTask('q',10,0),key,'hour',true,company),/Defina/);
 const once=setTaskCrewEmployee(initial,key,'hour',true,company);
 const twice=setTaskCrewEmployee(once,key,'month',true,company);
 assert.deepEqual(twice.employeeAssignments[key],['hour','month']);
 assert.deepEqual(setTaskCrewEmployee(twice,key,'month',false,company).employeeAssignments[key],['hour']);
 assert.throws(()=>setTaskCrewEmployee(baseTask('t',10,1),key,'painter',true,company),/profissão/);
 assert.throws(()=>setTaskCrewEmployee(setTaskCrewEmployee(baseTask('t',10,1),key,'hour',true,company),key,'month',true,company),/vagas/);
});
test('horistas are variable and monthly salaries only allocated, not paid twice',()=>{
 let t=baseTask();
 t=setTaskCrewEmployee(t,key,'hour',true,company);
 t=setTaskCrewEmployee(t,key,'month',true,company);
 const result=forecast([t]);
 assert.equal(result.assignedHH,15);
 assert.equal(result.unassignedHH,0);
 assert.equal(result.variableHourly,315); // 15 HH / 2 people * 42 reais
 assert.equal(result.allocatedMonthly,187.5); // 7.5 HH x 4400 / 176 h
 assert.equal(result.estimatedAssignedCost,502.5);
 assert.deepEqual(result.issues,[]);
});
test('a missing worker leaves unpriced HH rather than falsely claiming full cost',()=>{
 const t=setTaskCrewEmployee(baseTask(),key,'hour',true,company);
 const result=forecast([t]);
 assert.equal(result.variableHourly,315);
 assert.equal(result.allocatedMonthly,0);
 assert.equal(result.assignedHH,7.5);
 assert.equal(result.unassignedHH,7.5);
 assert.ok(result.issues.some(m=>m.includes('vaga(s) sem funcionário')));
});
test('no declared monthly work hours => salary is unpriced and flagged, not guessed',()=>{
 let t=setTaskCrewEmployee(baseTask('x',10,1),key,'month',true,company);
 const result=forecast([t],0,0);
 assert.equal(result.allocatedMonthly,0);
 assert.equal(result.assignedHH,15);
 assert.ok(result.issues.some(m=>m.includes('Defina dias/mês')));
});
test('same worker booked on parallel overlapping stages triggers capacity alert',()=>{
 let a=setTaskCrewEmployee(baseTask('A',10,1),key,'hour',true,company);
 let b=setTaskCrewEmployee(baseTask('B',10,1),key,'hour',true,company);
 const plan={...build([a,b]),scheduleMode:'dependencias'};
 const r=estimateWorkCrewCosts(plan,estimateSchedule(plan),company,22,8);
 assert.ok(r.issues.some(issue=>issue.includes('simultaneamente')));
 assert.equal(r.variableHourly,1260);
});
test('deleted staff and over-capacity assignments never create imaginary salary',()=>{
 const task={...baseTask('missing',10,1),employeeAssignments:{[key]:['deleted','hour']}};
 const r=forecast([task]);
 assert.equal(r.variableHourly,0);
 assert.equal(r.unassignedHH,15);
 assert.ok(r.issues.some(x=>x.includes('vagas')));
});
