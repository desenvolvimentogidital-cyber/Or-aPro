import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBdi} from '../.test-dist/utils/bdi.js';
const blank={administration:0,insurance:0,risk:0,guarantee:0,financial:0,profit:0,taxes:0};
test('BDI de zero porcento não acrescenta custo fictício',()=>{
 const r=calculateBdi(1000,blank);assert.equal(r.factor,1);assert.equal(r.sellingPrice,1000);assert.equal(r.bdiPercent,0);
});
test('BDI composto com taxas reais informadas usa tributos no denominador',()=>{
 const r=calculateBdi(1000,{...blank,administration:5,financial:2,profit:10,taxes:10});
 assert.ok(Math.abs(r.factor-1.05*1.02*1.1/.9)<1e-10);
 assert.ok(Math.abs(r.sellingPrice-1309)<1);
});
test('BDI rejeita custo inválido, imposto >= 100% e taxas negativas',()=>{
 assert.throws(()=>calculateBdi(0,blank),/custo direto/);
 assert.throws(()=>calculateBdi(1000,{...blank,taxes:100}),/Tributos/);
 assert.throws(()=>calculateBdi(1000,{...blank,profit:-1}),/Percentual/);
});
