import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScheduleDocument} from '../.test-dist/utils/scheduleDocument.js';
const schedule={id:'s1',title:'Obra <script>alert(1)</script>',startDate:'2026-10-09',hoursPerDay:8,efficiency:1,tasks:[{id:'t1',composition:{code:'XX001',description:'Executar serviço de teste',unit:'M2',labor:[{code:'10',role:'Pedreiro',hoursPerUnit:.5}],sourceFile:'SINAPI_user.xlsx',sourceSheet:'Analítico',reference:'08/2026'},quantity:10,crew:{'10:Pedreiro':1},progress:[]}],createdAt:'2026-10-09T00:00:00Z',updatedAt:'2026-10-09T00:00:00Z'};
test('PDF de cronograma usa quantidade e referências sem conteúdo inventado',()=>{
 const html=buildScheduleDocument(schedule);
 assert.match(html,/XX001/);assert.match(html,/08\/2026/);assert.match(html,/5 HH/);
 assert.match(html,/não é faturamento/i);assert.match(html,/Não informado/);
});
test('PDF escapa HTML do usuário sem executá-lo',()=>{
 const html=buildScheduleDocument(schedule);
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
});
