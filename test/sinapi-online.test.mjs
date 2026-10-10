import test from 'node:test';
import assert from 'node:assert/strict';
import {onlineSinapiPendingComposition} from '../.test-dist/services/sinapiOnline.js';
import {estimateSchedule} from '../.test-dist/utils/scheduleMath.js';

const fixture={code:'990001',description:'SERVIÇO FICTÍCIO DE HOMOLOGAÇÃO',unit:'UN'};
test('composição obtida em consulta textual online não inventa horas-homem nem mês/UF',()=>{
  const composition=onlineSinapiPendingComposition(fixture);
  assert.deepEqual(composition.labor,[]);
  assert.equal(composition.code,fixture.code);
  assert.equal(composition.reference,undefined);
  assert.equal(composition.uf,undefined);
  assert.match(composition.sourceFile,/SINPRES/);
  assert.throws(()=>onlineSinapiPendingComposition({...fixture,code:'CODE-INVENTADO'}));
});
test('etapa de catálogo textual SINAPI permanece pendente sem calcular duração ou esforço',()=>{
  const composition=onlineSinapiPendingComposition(fixture);
  const schedule={
    id:'qa',title:'Teste sem produtividade',startDate:'2026-10-09',
    hoursPerDay:8,efficiency:1,createdAt:'2026-10-09T12:00:00Z',updatedAt:'2026-10-09T12:00:00Z',
    tasks:[{id:'task',composition,quantity:22,crew:{},quoteItemId:'quote-1'}]
  };
  const report=estimateSchedule(schedule);
  assert.equal(report.entries.length,1);
  assert.equal(report.entries[0].days,null);
  assert.equal(report.entries[0].totalHH,0);
  assert.equal(report.finishDate,null);
  assert.equal(report.pending,1);
  assert.match(report.entries[0].warnings.join(' '),/Coeficiente de mão de obra inválido ou ausente/);
});
