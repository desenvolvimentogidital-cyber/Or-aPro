import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeMonthlyCosts,sinapiMonthlyReference,validateEmployeeCost} from '../.test-dist/utils/employeeCosts.js';
import {pricingWorkload} from '../.test-dist/utils/pricingWorkload.js';
function employee(id,paymentBasis,paymentAmount,plannedHoursPerMonth=0,monthlyExtras=0){
 return {id,name:'Funcionário '+id,role:'ELETRICISTA COM ENCARGOS COMPLEMENTARES',
 paymentBasis,paymentAmount,monthlyExtras,plannedHoursPerMonth};
}
test('funcionário mensalista compõe folha FIXA sem criar despesa paga',()=>{
 const costs=employeeMonthlyCosts([employee('1','monthly',3500,0,600)]);
 assert.equal(costs.fixed,4100);
 assert.equal(costs.variableEstimate,0);
 assert.equal(costs.forecast,4100);
});
test('horista com horas informadas compõe previsão VARIÁVEL, não despesa fixa',()=>{
 const costs=employeeMonthlyCosts([employee('1','monthly',3500,0,600),employee('2','hourly',42,80,50)]);
 assert.equal(costs.fixed,4100);
 assert.equal(costs.variableEstimate,3410);
 assert.equal(costs.forecast,7510);
 assert.equal(costs.unplannedHourly,0);
});
test('sem horas previstas não inventa horas, custo ou salário mensal',()=>{
 const c=employeeMonthlyCosts([employee('1','hourly',40)]);
 assert.equal(c.fixed,0);
 assert.equal(c.variableEstimate,0);
 assert.equal(c.unplannedHourly,1);
 assert.equal(sinapiMonthlyReference(41,pricingWorkload()),null);
});
test('custo oficial por H e equivalência NÃO são salário legal mensal',()=>{
 const workload=pricingWorkload(22,8);
 assert.equal(sinapiMonthlyReference(39.6,workload),6969.6);
 assert.equal(sinapiMonthlyReference(39.6,pricingWorkload(22,0)),null);
});
test('rejeita pagamento inválido, extras negativos e horas ilegítimas',()=>{
 for(const value of [0,-1,Infinity,NaN,1e10]){
  assert.throws(()=>validateEmployeeCost(employee('a','monthly',value)));
 }
 assert.throws(()=>validateEmployeeCost(employee('a','hourly',42,745)));
 assert.throws(()=>validateEmployeeCost(employee('a','hourly',42,10,-1)));
});
