import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSinapiOfficialCosts,sinapiCodeFromFormula} from '../.test-dist/utils/sinapiCosts.js';
const source={uf:'SP',reference:'08/2026',regime:'sem_desoneracao'};
function fixture(){const rows=Array.from({length:13},()=>[]);rows[0][0]='SINAPI - Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil';rows[1][0]='RELATÓRIO DE CUSTOS DE COMPOSIÇÕES - ENCARGOS SOCIAIS SEM DESONERAÇÃO';rows[2][1]='08/2026';rows[8][54]='SP';rows[9][54]='Custo (R$)';rows[10][1]='104658';rows[10][2]='PISO PODOTÁTIL';rows[10][3]='M2';rows[10][54]=208;rows[11][1]='96113';rows[11][2]='FORRO DE GESSO';rows[11][3]='M2';rows[11][54]=0;return rows;}
test('XLSX oficial CSD seleciona exclusivamente custo SP; ignora custo zero',()=>{const r=parseSinapiOfficialCosts(fixture(),'CSD',source);assert.equal(r.rows.length,1);assert.equal(r.rows[0].code,'104658');assert.equal(r.rows[0].unitCost,208);assert.equal(r.ignored,1);});
test('não aceita mês divergente',()=>{const r=fixture();r[2][1]='09/2026';assert.throws(()=>parseSinapiOfficialCosts(r,'CSD',source),/Referência da planilha/);});
test('não aceita regime de desoneração divergente',()=>assert.throws(()=>parseSinapiOfficialCosts(fixture(),'CCD',source),/aba CSD/));
test('não confunde porcentagem %AS com valor monetário',()=>{const r=fixture();r[10][55]=.34;assert.equal(parseSinapiOfficialCosts(r,'CSD',source).rows[0].unitCost,208);});
test('não aceita tabela diferente disfarçada de SINAPI',()=>{const r=fixture();r[1][0]='Percentuais mão de obra';assert.throws(()=>parseSinapiOfficialCosts(r,'CSD',source),/não corresponde/);});

test('código em HYPERLINK do XLSX recuperado sem avaliar fórmula',()=>{
  assert.equal(sinapiCodeFromFormula('HYPERLINK("#"&CELL("address",OFFSET(Analítico!$B$1,MATCH(104658,Analítico!$B:$B,0)-1,3)),104658)'), '104658');
  assert.equal(sinapiCodeFromFormula('SUM(1,104658)'),null);
  assert.equal(sinapiCodeFromFormula('HYPERLINK("url",0)'),null);
});
