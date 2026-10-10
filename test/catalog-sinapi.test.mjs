import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findCatalogSinapiCandidates, savedSinapiForQuote, usableSinapiComposition, compositionIdentity
} from '../.test-dist/utils/catalogSinapi.js';
import { simulateCrewForQuote } from '../.test-dist/utils/quoteSchedule.js';

// Apenas composições FICTÍCIAS para testar busca. Nunca são disponibilizadas aos clientes.
const fixture={
  code:'100001',description:'TOMADA DE EMBUTIR 2P+T 10A, INCLUINDO SUPORTE E PLACA - FORNECIMENTO E INSTALAÇÃO',
  unit:'UN',reference:'08/2026',uf:'SP',regime:'sem_desoneracao',
  sourceFile:'teste-analitico.csv',sourceSheet:'Analítico',
  labor:[{code:'99901',role:'Eletricista',hoursPerUnit:0.35},{code:'99902',role:'Auxiliar',hoursPerUnit:0.22}]
};
const other={...fixture,code:'100002',description:'PONTO DE LUZ EM TETO - EXECUÇÃO',labor:[{code:'99901',role:'Eletricista',hoursPerUnit:0.4}]};
const unitCostOnly={...fixture,labor:[],sourceSheet:'CSD'};

test('instalar tomada no catálogo recomenda composição analítica mesmo com unidade genérica',()=>{
 const saved={name:'Instalar uma tomada na parede',unit:'serviço'};
 const choices=findCatalogSinapiCandidates(saved,[other,fixture]);
 assert.deepEqual(choices.map(x=>x.code),['100001']);
 const crew=simulateCrewForQuote(choices[0],6,8,1);
 assert.ok(Math.abs(crew.totalHH-(0.35+0.22)*6)<0.000001);
 assert.equal(crew.projectedDays,1);
});
test('busca reconhece plural, acentos e codigo explicitamente pesquisado',()=>{
 assert.equal(findCatalogSinapiCandidates({name:'Trocar tomadas',unit:'UN'},[fixture])[0]?.code,'100001');
 assert.equal(findCatalogSinapiCandidates({name:'Serviço elétrico',unit:'serviço'},[other,fixture],'instalação tomada')[0]?.code,'100001');
 assert.equal(findCatalogSinapiCandidates({name:'Outro serviço',unit:'serviço'},[other,fixture],'100001')[0]?.code,'100001');
 assert.equal(findCatalogSinapiCandidates({name:'',unit:''},[other,fixture],'100')[0]?.code,'100001');
 assert.equal(findCatalogSinapiCandidates({name:'',unit:''},[other,fixture],'SINAPI 100001')[0]?.code,'100001');
 assert.equal(findCatalogSinapiCandidates({name:'',unit:''},[other,fixture],'tomada')[0]?.code,'100001');
 assert.equal(findCatalogSinapiCandidates({name:'Pintura de parede',unit:'m²'},[fixture]).length,0);
});
test('somente associação com horas, fonte, competência e UF validas sobrevive ao reload',()=>{
 assert.ok(usableSinapiComposition(fixture));
 assert.ok(!usableSinapiComposition(unitCostOnly));
 assert.ok(!usableSinapiComposition({...fixture,reference:undefined}));
 assert.ok(!usableSinapiComposition({...fixture,uf:undefined}));
 assert.ok(!usableSinapiComposition({...fixture,labor:[{code:'x',role:'Eletricista',hoursPerUnit:0}]}));
 const item={id:'cat-1',name:'Instalação de tomada',type:'servico',unit:'serviço',price:100,category:'Elétrica',
   sinapiComposition:fixture};
 const fromOldQuote=savedSinapiForQuote({id:'item-1',name:'Instalação de tomada',unit:'serviço',
   type:'servico',quantity:5,unitPrice:100,totalPrice:500},[item]);
 assert.equal(fromOldQuote?.code,'100001');
 assert.equal(savedSinapiForQuote({id:'item-2',name:'Pintura',unit:'m²',
   type:'servico',quantity:5,unitPrice:100,totalPrice:500},[item]),undefined);
 assert.equal(savedSinapiForQuote({id:'item-3',name:'Tomada',unit:'UN',catalogItemId:'cat-1',
   type:'servico',quantity:5,unitPrice:100,totalPrice:500},[item])?.code,'100001');
 assert.notEqual(compositionIdentity(fixture),compositionIdentity({...fixture,reference:'09/2026'}));
});
test('busca nao transforma composicao de custo sem HH em etapa',()=>{
 assert.deepEqual(findCatalogSinapiCandidates({name:'Tomada',unit:'UN'},[unitCostOnly]),[]);
});
