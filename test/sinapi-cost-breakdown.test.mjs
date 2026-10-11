import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSinapiCostBreakdown,sinapiInputCategory}
  from '../.test-dist/utils/sinapiCostBreakdown.js';
const U='PR',R='com_desoneracao';
const prices=(price)=>({[R]:{[U]:price}});
const analytical=[
 {code:'111111',unit:'M2',items:[
   {type:'composition',code:'222222',unit:'H',coefficient:'2',status:'COM CUSTO'},
   {type:'input',code:'1000',unit:'UN',coefficient:'3',status:'COM PREÇO'},
   {type:'input',code:'1001',unit:'UN',coefficient:'1',status:'COM PREÇO'},
   {type:'input',code:'1002',unit:'UN',coefficient:'0.5',status:'COM PREÇO'}
 ]},
 {code:'222222',unit:'H',items:[
   {type:'input',code:'1003',unit:'H',coefficient:'1',status:'COM PREÇO'}
 ]}
];
const inputs=[
 {code:'1000',unit:'UN',classification:'MATERIAL',costs_in_cents:prices(1000)},
 {code:'1001',unit:'UN',classification:'EQUIPAMENTO (LOCAÇÃO)',costs_in_cents:prices(2000)},
 {code:'1002',unit:'UN',classification:'ENCARGOS COMPLEMENTARES',costs_in_cents:prices(1000)},
 {code:'1003',unit:'H',classification:'MAO DE OBRA',costs_in_cents:prices(5000)}
];
const whole=(cost)=>({code:'111111',unit:'M2',costs_in_cents:prices(cost)});
const run=(a=analytical,i=inputs,total=15500)=>calculateSinapiCostBreakdown(
 {code:'111111',unit:'M2'},U,R,a,i,whole(total));
test('decompõe composição auxiliar e diferencia mão de obra, material, equipamento e encargos',()=>{
 const v=run();
 assert.equal(v.labor,100);
 assert.equal(v.material,30);
 assert.equal(v.equipment,20);
 assert.equal(v.other,5);
 assert.equal(v.knownTotal,155);
 assert.equal(v.officialTotal,155);
 assert.equal(v.status,'reconciled');
});
test('sem insumo, nunca chama a parcela conhecida de custo integral',()=>{
 const r=run(analytical,inputs.filter(x=>x.code!=='1000'));
 assert.equal(r.status,'partial');
 assert.equal(r.missingCount,1);
 assert.equal(r.material,0);
 assert.equal(r.knownTotal,125);
 assert.match(r.issues.join(' '),/Preço do insumo ausente/);
});
test('diferença para custo global oficial impede conciliação falsa',()=>{
 const r=run(analytical,inputs,16000);
 assert.equal(r.status,'discrepant');
 assert.equal(r.difference,-5);
});
test('ciclo de composições não é percorrido infinitamente',()=>{
 const cyclic=[{code:'111111',unit:'M2',items:[
  {type:'composition',code:'111111',unit:'M2',coefficient:'1',status:'COM CUSTO'}]}];
 const v=run(cyclic);
 assert.equal(v.status,'partial');
 assert.ok(v.issues.some(x=>x.includes('Ciclo')));
});
test('classificação desconhecida não é material por suposição',()=>{
 assert.equal(sinapiInputCategory('ENCARGOS COMPLEMENTARES'),'other');
 assert.equal(sinapiInputCategory('SERVIÇOS'),'other');
 assert.equal(sinapiInputCategory('ESPECIAIS'),'other');
 assert.equal(sinapiInputCategory('EQUIPAMENTO (AQUISIÇÃO)'),'equipment');
});
test('sem custo global publicado sinaliza decomposição não conciliada',()=>{
 const r=calculateSinapiCostBreakdown({code:'111111',unit:'M2'},U,R,analytical,inputs,null);
 assert.equal(r.status,'partial');
 assert.equal(r.officialTotal,null);
});

test('SINAPI real: centavos de auxiliares não equivalem a divergência grande nem conciliação exata',()=>{
 // A referência 104596 PR CCD do XLSX tem R$148,29; sua decomposição
 // integral em insumos sem arredondamentos intermediários soma ~R$148,33.
 const details=[{code:'104596',unit:'M2',items:[
  {type:'input',code:'50001',unit:'UN',coefficient:'1',status:'COM PREÇO'},
  {type:'input',code:'50002',unit:'UN',coefficient:'1',status:'COM PREÇO'},
  {type:'input',code:'50003',unit:'UN',coefficient:'1',status:'COM PREÇO'},
  {type:'input',code:'50004',unit:'UN',coefficient:'1',status:'COM PREÇO'},
  {type:'input',code:'50005',unit:'UN',coefficient:'1',status:'COM PREÇO'}
 ]}];
 const parts=[4000,9266,1563,2,2].map((c,i)=>({
  code:String(50001+i),unit:'UN',
  classification:i===0?'MAO DE OBRA':i===1?'MATERIAL':'ENCARGOS COMPLEMENTARES',
  costs_in_cents:prices(c)
 }));
 const official={code:'104596',unit:'M2',costs_in_cents:prices(14829)};
 const estimate=calculateSinapiCostBreakdown({code:'104596',unit:'M2'},U,R,details,parts,official);
 assert.equal(estimate.knownTotal,148.33);
 assert.equal(estimate.officialTotal,148.29);
 assert.equal(estimate.difference,0.04);
 assert.equal(estimate.roundingTolerance,0.05);
 assert.equal(estimate.status,'rounding');
 assert.ok(estimate.issues.some(x=>x.includes('arredondamentos')));
 const biggerGap=calculateSinapiCostBreakdown({code:'104596',unit:'M2'},U,R,details,parts,{
  ...official,costs_in_cents:prices(14700)
 });
 assert.equal(biggerGap.status,'discrepant');
});
