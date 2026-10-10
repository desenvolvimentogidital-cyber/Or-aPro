import test from 'node:test';
import assert from 'node:assert/strict';
import {pricingWorkload} from '../.test-dist/utils/pricingWorkload.js';
import {pricingEstimate} from '../.test-dist/utils/quoteMath.js';

test('jornada não é preenchida com defaults inventados ao criar a conta',()=>{
 const empty=pricingWorkload();
 assert.equal(empty.valid,false);
 assert.equal(empty.missing,true);
 assert.equal(empty.hoursPerMonth,0);
 assert.match(empty.message,/Informe os dias trabalhados/i);
});
test('22 dias e 8h diárias calculam 176h mensais e rateiam corretamente os R$ 16.200 do print',()=>{
 const result=pricingWorkload(22,8);
 assert.equal(result.valid,true);
 assert.equal(result.hoursPerMonth,176);
 const price=pricingEstimate({
   monthlyExpenses:16200,workDays:result.days,workHours:result.hoursPerMonth,
   margin:0,tax:0,material:0,jobHours:8,travel:0
 });
 assert.equal(price.costPerDay,16200/22);
 assert.equal(price.costPerHour,16200/176);
 assert.equal(price.directCost,16200/22);
});
test('exige dias inteiros, no máximo 31, e horas por dia entre 0,5 e 24',()=>{
 for(const [days,hours] of [[0,8],[22,0],[32,8],[22,25],[20.5,8],[-1,8],[22,-1],[NaN,8],[22,Infinity]]){
   assert.equal(pricingWorkload(days,hours).valid,false,`${days} dias, ${hours} horas`);
 }
 assert.equal(pricingWorkload(20,7.5).hoursPerMonth,150);
 assert.equal(pricingWorkload(31,24).hoursPerMonth,744);
});
test('configuração operacional mantém cálculo separado de equipe SINAPI e não altera orçamentos salvos',()=>{
 const company={name:'Minha empresa',pricingWorkDaysPerMonth:22,pricingHoursPerDay:8};
 const hydrated=structuredClone(company);
 assert.equal(pricingWorkload(hydrated.pricingWorkDaysPerMonth,hydrated.pricingHoursPerDay).hoursPerMonth,176);
 assert.deepEqual(hydrated,company);
});
