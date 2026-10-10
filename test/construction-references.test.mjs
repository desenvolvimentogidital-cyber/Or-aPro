import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustmentIndices,costReferences,defaultConstructionReferences,validReferenceSettings,
  costReferenceName,adjustmentIndexName
} from '../.test-dist/utils/constructionReferences.js';
import {buildScheduleDocument} from '../.test-dist/utils/scheduleDocument.js';
import {estimateSchedule} from '../.test-dist/utils/scheduleMath.js';

test('bases oficiais, regionais, privadas e personalizadas são opções distintas de índices de reajuste',()=>{
  for(const name of ['SINAPI','SICRO','ORSE','SEINFRA_CE','EMOP_RJ','CDHU_SP','TCPO','OUTRA']){
    assert.ok(costReferences.some(x=>x.id===name),'Base ausente: '+name);
  }
  for(const name of ['NENHUM','INCC','IPCA','INPC','IGPM','CUB','OUTRO']){
    assert.ok(adjustmentIndices.some(x=>x.id===name),'Índice ausente: '+name);
  }
  assert.deepEqual(defaultConstructionReferences(),{costReference:'SINAPI',adjustmentIndex:'NENHUM'});
});
test('não aceita outro sem nome nem competência inválida; preserva descrição',()=>{
  const settings={costReference:'OUTRA',customCostReference:'Tabela municipal própria',adjustmentIndex:'OUTRO',
    customAdjustmentIndex:'Correção contratual',baseMonth:'09/2026',uf:'SP'};
  assert.equal(validReferenceSettings(settings),true);
  assert.equal(costReferenceName(settings),'Tabela municipal própria');
  assert.equal(adjustmentIndexName(settings),'Correção contratual');
  assert.equal(validReferenceSettings({...settings,customCostReference:''}),false);
  assert.equal(validReferenceSettings({...settings,baseMonth:'15/2026'}),false);
  assert.equal(validReferenceSettings({...settings,uf:'XYZ'}),false);
  assert.equal(validReferenceSettings({...settings,adjustmentIndex:'INCC'}),true);
});
test('preferência não altera prazo, HH ou quantitativos; aparece no PDF técnico',()=>{
  const schedule={id:'qa',title:'Obra de teste',startDate:'2026-10-09',hoursPerDay:8,
    efficiency:1,createdAt:'2026-10-09T10:00:00Z',updatedAt:'2026-10-09T10:00:00Z',
    tasks:[{id:'item',quantity:6,crew:{'a:Eletricista':1},composition:{
      code:'99991',description:'SERVIÇO DE TESTE — NÃO OFICIAL',unit:'UN',
      labor:[{code:'a',role:'Eletricista',hoursPerUnit:2}],
      sourceFile:'teste-interno.csv',sourceSheet:'Analítico',reference:'09/2026',uf:'SP',regime:'sem_desoneracao'
    }}]};
  const a=estimateSchedule(schedule);
  const settings={costReference:'SICRO',adjustmentIndex:'INCC',baseMonth:'09/2026',uf:'SP'};
  const b=estimateSchedule({...schedule,referenceSettings:settings});
  assert.equal(b.totalHH,a.totalHH);
  assert.equal(b.workingDays,a.workingDays);
  assert.equal(b.finishDate,a.finishDate);
  const html=buildScheduleDocument({...schedule,referenceSettings:settings});
  assert.ok(html.includes('SICRO — DNIT'));
  assert.ok(html.includes('INCC — custo da construção'));
  assert.ok(html.includes('Não aplicado automaticamente'));
  const legacyHtml=buildScheduleDocument(schedule);
  assert.ok(!legacyHtml.includes('Índice de reajuste informado'));
});
