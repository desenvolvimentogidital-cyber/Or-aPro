import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNumericDraft} from '../.test-dist/utils/numericEditing.js';

test('permite apagar tudo enquanto o campo está em edição',()=>{
  assert.equal(parseNumericDraft(''),null);
  assert.equal(parseNumericDraft('  '),null);
  assert.equal(parseNumericDraft('-'),null);
  assert.equal(parseNumericDraft('1,'),1);
});
test('aceita valor novo, zero, decimal brasileiro e pontos sem modificar a magnitude',()=>{
  assert.equal(parseNumericDraft('0'),0);
  assert.equal(parseNumericDraft('1200'),1200);
  assert.equal(parseNumericDraft('2,75'),2.75);
  assert.equal(parseNumericDraft('0.75'),0.75);
  assert.equal(parseNumericDraft('.5'),0.5);
  assert.equal(parseNumericDraft('  125,50  '),125.5);
});
test('rejeita infinito, texto e formatos confusos sem sobrescrever o dado real',()=>{
  for(const x of ['Infinity','NaN','12x','1,2.3','--5','1e10000','1.234,56']){
    assert.equal(parseNumericDraft(x),null,x);
  }
});
