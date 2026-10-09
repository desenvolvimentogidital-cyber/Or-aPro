import test from 'node:test';
import assert from 'node:assert/strict';
import {addDiaryRecord,validateDiaryEntry,validStatus} from '../.test-dist/utils/workDiary.js';
const item=(extra={})=>({id:'evt-1',date:'2026-10-08',kind:'diario',description:'Execução da atividade verificada em campo.',responsible:'Responsável informado',workerCount:3,createdAt:'2026-10-08T16:00:00Z',...extra});
const schedule={id:'s1',title:'Obra',tasks:[],createdAt:'2026-10-08T00:00:00Z',updatedAt:'2026-10-08T00:00:00Z'};
test('diário começa vazio e salva evento somente quando informado',()=>{
 assert.equal(schedule.diary,undefined);
 const result=addDiaryRecord(schedule,item());
 assert.equal(result.diary.length,1);assert.equal(result.diary[0].description,item().description);
 assert.equal(schedule.diary,undefined);
});
test('validação rejeita datas impossíveis, pessoas negativas e relatórios anônimos',()=>{
 assert.throws(()=>validateDiaryEntry(item({date:'2026-02-30'})),/data real/);
 assert.throws(()=>validateDiaryEntry(item({workerCount:-1})),/trabalhadores/);
 assert.throws(()=>validateDiaryEntry(item({responsible:'   '})),/responsável/);
 assert.throws(()=>validateDiaryEntry(item({description:'A'})),/Descreva/);
});
test('id duplicado de registro operacional não pode ser gravado novamente',()=>{
 const first=addDiaryRecord(schedule,item());
 assert.throws(()=>addDiaryRecord(first,item()),/duplicado/);
});
test('status operacional é manual e limitado a opções concretas',()=>{
 assert.equal(validStatus('paralisada'),true);
 assert.equal(validStatus('pagamento_confirmado_automaticamente'),false);
});
