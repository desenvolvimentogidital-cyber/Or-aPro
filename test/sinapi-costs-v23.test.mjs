import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSinapiUnitCosts} from '../.test-dist/utils/sinapiCosts.js';
const uf={uf:'SP',reference:'08/2026',regime:'sem_desoneracao'};
test('preços SINAPI normalizados são custo, sem preço de venda automático',()=>{const r=parseSinapiUnitCosts('Código composição;Descrição;Unidade;Custo unitário\n96113;Forro de gesso;m²;58,51\n',uf);assert.equal(r.rows[0].unitCost,58.51);assert.equal(r.rows[0].source.uf,'SP');assert.equal('sellingPrice' in r.rows[0],false);});
test('não aceita horas-homem como se fossem custos monetários',()=>assert.throws(()=>parseSinapiUnitCosts('Código composição;Descrição;Unidade;HH por unidade\n96113;Forro;m²;0,48\n',uf),/CSV de custos/));
test('duplicidade conflitante não soma nem sobrescreve preços',()=>assert.throws(()=>parseSinapiUnitCosts('Código composição;Descrição;Unidade;Custo unitário\n96113;Forro;m²;58,51\n96113;Forro;m²;60,00',uf),/conflitantes/));
test('custo inválido não entra em orçamento nem catálogo',()=>assert.throws(()=>parseSinapiUnitCosts('Código composição;Descrição;Unidade;Custo unitário\n96113;Forro;m²;-1\n',uf),/Não há custos/));
