import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSinapiRows,mergeSinapiReports} from '../.test-dist/utils/sinapi.js';
import {estimateSchedule, nextWorkday} from '../.test-dist/utils/scheduleMath.js';

const flat=[
  ['Código Composição','Descrição Composição','Unidade Composição','Código Insumo','Descrição Insumo','Unidade Insumo','Coeficiente','Tipo'],
  ['103332','ALVENARIA DE VEDAÇÃO','M2','88309','PEDREIRO COM ENCARGOS COMPLEMENTARES','H','0,3200','COMPOSICAO AUXILIAR'],
  ['103332','ALVENARIA DE VEDAÇÃO','M2','88316','SERVENTE COM ENCARGOS COMPLEMENTARES','H','0,1600','COMPOSICAO AUXILIAR'],
  ['103332','ALVENARIA DE VEDAÇÃO','M2','00001','TIJOLO CERAMICO','UN','14,2','INSUMO'],
  ['103332','ALVENARIA DE VEDAÇÃO','M2','99999','BETONEIRA ELETRICA','H','0,3','EQUIPAMENTO'],
];
test('SINAPI imports only measured H labor coefficients and preserves source',()=>{
  const r=parseSinapiRows(flat,'fonte.xlsx','Analítico');
  assert.equal(r.compositions.length,1);
  assert.equal(r.compositions[0].labor.length,2);
  assert.equal(r.compositions[0].labor.reduce((n,l)=>n+l.hoursPerUnit,0),.48);
  assert.equal(r.compositions[0].sourceFile,'fonte.xlsx');
});
test('SINAPI detects hierarchical analytical reports',()=>{
  const r=parseSinapiRows([
    ['TIPO','CÓDIGO','DESCRIÇÃO','UNID','COEFICIENTE'],
    ['COMPOSIÇÃO','98000','EXECUÇÃO DE FORRO','M2',''],
    ['COMPOSIÇÃO AUXILIAR','88309','PEDREIRO COM ENCARGOS COMPLEMENTARES','H','0,75'],
    ['COMPOSIÇÃO AUXILIAR','88316','SERVENTE COM ENCARGOS COMPLEMENTARES','H','0,25'],
  ],'relatorio.csv','CSV');
  assert.equal(r.compositions[0].code,'98000');
  assert.equal(r.compositions[0].labor.length,2);
});
test('cost-only table rejected, never infers productivity from unit cost',()=>{
  const r=parseSinapiRows([['Código','Descrição','Unidade','Custo total'],['103332','ALVENARIA','M2','35,00']],'custos.xlsx','SP');
  assert.equal(r.compositions.length,0);
  assert.ok(r.issues.length);
});
test('schedule estimates crew bottleneck per occupation and skips weekends',()=>{
  const source=parseSinapiRows(flat,'fonte.xlsx','Analítico').compositions[0];
  const task={id:'a',composition:source,quantity:100,crew:Object.fromEntries(source.labor.map(l=>[`${l.code}:${l.role}`,l.code==='88309'?1:2]))};
  const plan={id:'1',title:'Obra',startDate:'2026-10-09',hoursPerDay:8,efficiency:1,tasks:[task,task]};
  const result=estimateSchedule(plan);
  assert.equal(result.entries[0].totalHH,48);
  assert.equal(result.entries[0].days,4); // pedreiro 32h / 8 = 4 vs servente 16/16 = 1
  assert.equal(result.entries[0].start,'2026-10-09');
  assert.equal(result.entries[0].end,'2026-10-14');
  assert.equal(result.entries[1].start,'2026-10-15');
  assert.equal(result.finishDate,'2026-10-20');
});
test('no fake crew: duration absent when workers have not been provided',()=>{
  const comp=parseSinapiRows(flat,'x','aba').compositions[0];
  const result=estimateSchedule({startDate:'2026-10-12',hoursPerDay:8,efficiency:1,tasks:[{id:'a',composition:comp,quantity:100,crew:{}}]});
  assert.equal(result.finishDate,null);
  assert.equal(result.pending,1);
  assert.ok(result.entries[0].warnings.some(w=>w.includes('profissionais')));
});
test('invalid quantities and rates cannot emit a fabricated date',()=>{
  const comp=parseSinapiRows(flat,'x','aba').compositions[0];
  const result=estimateSchedule({startDate:'2026-10-12',hoursPerDay:0,efficiency:1,tasks:[{id:'a',composition:comp,quantity:-1,crew:{}}]});
  assert.equal(result.finishDate,null);
});
test('merged import keeps last unique composition per code and unit',()=>{
  const parsed=parseSinapiRows(flat,'x.xlsx','aba');
  assert.equal(mergeSinapiReports([parsed,parsed]).compositions.length,1);
});

test('formato oficial SINAPI Analítico expande serviços auxiliares em HH por profissão',()=>{
  const rows=[
    ['SINAPI'],['RELATÓRIO ANALÍTICO DE COMPOSIÇÕES'],['Mês de Referência:','08/2026'],[],[],[],[],[],
    ['Grupo','Código da\nComposição','Tipo Item','Código do\nItem','Descrição','Unidade','Coeficiente','Situação'],
    ['Alvenaria',104658,'','','PISO PODOTÁTIL','M2','','COM CUSTO'],
    ['Alvenaria',104658,'COMPOSICAO',88316,'SERVENTE COM ENCARGOS COMPLEMENTARES','H',1.279,'COM CUSTO'],
    ['Alvenaria',104658,'COMPOSICAO',88309,'PEDREIRO COM ENCARGOS COMPLEMENTARES','H',0.639,'COM CUSTO'],
    ['Alvenaria',105002,'','','RAMPA COM PISO PODOTÁTIL','UN','','COM CUSTO'],
    ['Alvenaria',105002,'COMPOSICAO',104658,'PISO PODOTÁTIL','M2',0.48,'COM CUSTO'],
    ['Alvenaria',105002,'INSUMO',11111,'ARGAMASSA COLANTE','KG',3,'COM PREÇO'],
  ];
  const report=parseSinapiRows(rows,'SINAPI_Referência_2026_08.xlsx','Analítico');
  assert.equal(report.reference,'08/2026');
  assert.equal(report.compositions.length,2);
  const nested=report.compositions.find(x=>x.code==='105002');
  assert.equal(nested.unit,'UN');
  assert.equal(nested.labor.length,2);
  assert.ok(Math.abs(nested.labor.find(x=>x.code==='88316').hoursPerUnit-0.61392)<1e-9);
  assert.ok(Math.abs(nested.labor.find(x=>x.code==='88309').hoursPerUnit-0.30672)<1e-9);
});

test('SINAPI referencial incompleto não produz estimativa parcial de execução',()=>{
  const rows=[['SINAPI'],[],['Mês de Referência:','08/2026'],[],[],[],[],[],
  ['Grupo','Código da\nComposição','Tipo Item','Código do\nItem','Descrição','Unidade','Coeficiente','Situação'],
  ['G',105002,'','','SERVIÇO','M2','','COM CUSTO'],
  ['G',105002,'COMPOSICAO',99999,'COMPOSIÇÃO NÃO ENCONTRADA','M2',0.3,'COM CUSTO'],
  ['G',105002,'COMPOSICAO',88316,'SERVENTE COM ENCARGOS COMPLEMENTARES','H',0.8,'COM CUSTO']];
  const report=parseSinapiRows(rows,'referencia.xlsx','Analítico');
  assert.equal(report.compositions.length,0);
  assert.ok(report.issues.some(x=>x.includes('auxiliares ausentes')));
});


test('importação rejeita composição de referências de meses diferentes',()=>{
  const p=parseSinapiRows(flat,'mesA.xlsx','Analítico');
  assert.throws(()=>mergeSinapiReports([{...p,reference:'07/2026'},{...p,reference:'08/2026'}]),/competências diferentes/);
});


test('SINAPI oficial: EPI e ferramentas horistas não viram profissionais ou HH',()=>{
  const rows=[
    ['SINAPI'],['RELATÓRIO ANALÍTICO DE COMPOSIÇÕES'],['Mês de Referência:','09/2026'],
    [],[],[],[],[],
    ['Grupo','Código da\nComposição','Tipo Item','Código do\nItem','Descrição','Unidade','Coeficiente','Situação'],
    ['Acessibilidade',105006,'','','RAMPA DE ACESSIBILIDADE','UN','','COM CUSTO'],
    ['Acessibilidade',105006,'COMPOSICAO',88316,'SERVENTE COM ENCARGOS COMPLEMENTARES','H',2.189,'COM CUSTO'],
    ['Acessibilidade',105006,'COMPOSICAO',88309,'PEDREIRO COM ENCARGOS COMPLEMENTARES','H',1.094,'COM CUSTO'],
    ['Acessibilidade',105006,'INSUMO',43488,'EPI - FAMILIA OPERADOR ESCAVADEIRA - HORISTA (ENCARGOS COMPLEMENTARES - COLETADO CAIXA)','H',.811428164,'COM PREÇO'],
    ['Acessibilidade',105006,'INSUMO',43464,'FERRAMENTAS - FAMILIA OPERADOR ESCAVADEIRA - HORISTA (ENCARGOS COMPLEMENTARES - COLETADO CAIXA)','H',.811428164,'COM PREÇO'],
  ];
  const result=parseSinapiRows(rows,'SINAPI_Referência_2026_09.xlsx','Analítico');
  assert.equal(result.compositions.length,1);
  const labor=result.compositions[0].labor;
  assert.deepEqual(labor.map(l=>l.code).sort(),['88309','88316']);
  assert.ok(Math.abs(labor.reduce((sum,l)=>sum+l.hoursPerUnit,0)-3.283)<1e-9);
});
