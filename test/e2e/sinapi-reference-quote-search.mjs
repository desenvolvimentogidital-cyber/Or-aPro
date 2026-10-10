import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Reprodução do erro: orçamento usa nomes comerciais diferentes da descrição SINAPI.
// REST do Supabase totalmente simulado; nenhum dado da conta de produção é alterado.
// Coeficientes das composições selecionadas são reproduzidos da fonte SINAPI 09/2026
// somente para validar a navegação e o cálculo, com sessão isolada de teste.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const now='2026-10-10T12:00:00Z';
const ref='09/2026',sourceFile='SINAPI_Referência_2026_09.xlsx',sourceSheet='Analítico';
const compositions=[
 {code:'100860',description:'CHUVEIRO ELÉTRICO COMUM CORPO PLÁSTICO, TIPO DUCHA - FORNECIMENTO E INSTALAÇÃO. AF_02/2026',
  unit:'UN',reference:ref,sourceFile,sourceSheet,labor:[
   {code:'88316',role:'SERVENTE COM ENCARGOS COMPLEMENTARES',hoursPerUnit:0.4535436},
   {code:'88267',role:'ENCANADOR OU BOMBEIRO HIDRÁULICO COM ENCARGOS COMPLEMENTARES',hoursPerUnit:1.1816004}]},
 {code:'101493',description:'ENTRADA DE ENERGIA ELÉTRICA, AÉREA, MONOFÁSICA, COM CAIXA DE EMBUTIR, CABO DE 10 MM2 E DISJUNTOR DIN 50A (NÃO INCLUSO O POSTE DE CONCRETO). AF_12/2025',
  unit:'UN',reference:ref,sourceFile,sourceSheet,labor:[
   {code:'88264',role:'ELETRICISTA COM ENCARGOS COMPLEMENTARES',hoursPerUnit:2.5614},
   {code:'88247',role:'AUXILIAR DE ELETRICISTA COM ENCARGOS COMPLEMENTARES',hoursPerUnit:0.5123}]},
 {code:'101494',description:'ENTRADA DE ENERGIA ELÉTRICA, AÉREA, MONOFÁSICA, COM CAIXA DE EMBUTIR, CABO DE 16 MM2 E DISJUNTOR DIN 50A (NÃO INCLUSO O POSTE DE CONCRETO). AF_12/2025',
  unit:'UN',reference:ref,sourceFile,sourceSheet,labor:[
   {code:'88264',role:'ELETRICISTA COM ENCARGOS COMPLEMENTARES',hoursPerUnit:2.5614},
   {code:'88247',role:'AUXILIAR DE ELETRICISTA COM ENCARGOS COMPLEMENTARES',hoursPerUnit:0.5123}]}
];
const quote={id:'qa-orcamento-sinapi',number:'#QA-909',clientId:'qa',clientName:'Cliente teste',
 status:'rascunho',date:'2026-10-10',validUntil:'2026-12-20',
 items:[
  {id:'qa-chuveiro',name:'Chuveiro',unit:'un',type:'servico',quantity:22,unitPrice:120,totalPrice:2640},
  {id:'qa-mono',name:'Padrão monofásico',unit:'un',type:'servico',quantity:6,unitPrice:400,totalPrice:2400}
 ],subtotal:5040,total:5040,netProfit:0,travelCost:0,otherCosts:0,
 discountType:'fixed',discountValue:0,taxRate:0,targetMarginRate:0,modelTemplate:'padrao',visibility:{}};
const store={revision:1,payload:{
 quotes:[quote],clients:[],catalog:[],expenses:[],notifications:[],financeEntries:[],
 company:{name:'Empresa QA',tradeName:'Empresa QA',state:'SP'},
 schedules:[{id:'qa-cronograma',title:'Obra teste',quoteId:quote.id,startDate:'2026-10-10',
  hoursPerDay:8,efficiency:1,tasks:[],createdAt:now,updatedAt:now}],
 lastQuoteNumber:909
}};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
 'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[],queries=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
 access_token:'qa-isolated',refresh_token:'qa-isolated',expires_at:Date.now()+3600000,
 user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
})));
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,
  body:JSON.stringify([{payload:store.payload,revision:store.revision}])});
 const data=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH'&&data.revision===store.revision+1){
  store.payload=structuredClone(data.payload);store.revision=data.revision;
  return route.fulfill({status:200,headers,body:JSON.stringify([{revision:store.revision}])});
 }
 return route.fulfill({status:409,headers,body:'{"error":"Conflito QA"}'});
});
await page.route('**/rest/v1/rpc/orcapro_sinapi_library_count',route=>
 route.fulfill({status:200,headers,body:'9136'}));
await page.route('**/rest/v1/rpc/orcapro_find_sinapi',route=>{
 const req=JSON.parse(route.request().postData()||'{}');
 const q=String(req.p_query||'').toLowerCase();
 queries.push(q);
 // Simula a busca já confirmada no Supabase: texto comercial "Padrão monofásico"
 // retorna descrições oficiais "ENTRADA DE ENERGIA ELÉTRICA MONOFÁSICA".
 const hits=q.includes('chuveiro')||q.includes('100860')?[compositions[0]]:
   q.includes('padrao')||q.includes('padrão')||q.includes('monofas')||q.includes('10149')
    ?compositions.slice(1):q.includes('91996')?[{...compositions[0],code:'91996',description:'TOMADA MÉDIA'}]:[];
 return route.fulfill({status:200,headers,body:JSON.stringify(hits)});
});
await page.route('**/api/sinapi-search?*',route=>route.fulfill({
 status:200,headers,body:JSON.stringify({data:[],source:'SINPRES'})}));
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
   .getByRole('button',{name:'Cronograma'}).click();
 const region=page.getByRole('region',{name:'Do orçamento para o cronograma'});
 await region.waitFor();
 await page.getByText(/9.136 composições persistidas no Supabase/).waitFor({timeout:10000});
 await region.getByRole('button',{name:/Chuveiro/}).click();
 await region.getByText(/1 composição\(ões\) da biblioteca SINAPI/).waitFor({timeout:13000});
 let options=region.getByLabel(/Confirme a composição adequada/);
 let entry=options.locator('option').filter({hasText:/^100860/});
 await entry.waitFor({state:'attached'});
 await options.selectOption(await entry.getAttribute('value'));
 await region.getByLabel('UF para etapa do orçamento').selectOption('SP');
 await region.getByLabel('Encargos para etapa do orçamento').selectOption('sem_desoneracao');
 await region.getByText(/35,97 HH/).last().waitFor({timeout:5000});
 await region.getByRole('button',{name:'Adicionar etapa com equipe simulada'}).click();
 await page.waitForTimeout(1000);
 assert.equal(store.payload.schedules[0].tasks.length,1);
 assert.equal(store.payload.schedules[0].tasks[0].quoteItemId,'qa-chuveiro');
 assert.equal(store.payload.schedules[0].tasks[0].composition.code,'100860');

 await region.getByRole('button',{name:/Padrão monofásico/}).click();
 await region.getByText(/2 composição\(ões\) da biblioteca SINAPI/).waitFor({timeout:13000});
 options=region.getByLabel(/Confirme a composição adequada/);
 entry=options.locator('option').filter({hasText:/^101493/});
 await entry.waitFor({state:'attached'});
 assert.ok((await options.locator('option').allTextContents()).some(x=>x.includes('101494')),
  'Diferentes cabos devem permanecer como opções para escolha humana');
 await options.selectOption(await entry.getAttribute('value'));
 await region.locator('p').filter({hasText:/ENTRADA DE ENERGIA ELÉTRICA, AÉREA, MONOFÁSICA/}).first().waitFor({state:'visible'});
 // A escolha anterior de SP e encargos é reaproveitada na sessão, com código diferente.
 await region.getByRole('button',{name:'Adicionar etapa com equipe simulada'}).click();
 await page.waitForTimeout(1000);
 assert.equal(store.payload.schedules[0].tasks.length,2);
 const mono=store.payload.schedules[0].tasks[1];
 assert.equal(mono.quoteItemId,'qa-mono');
 assert.equal(mono.composition.code,'101493');
 assert.equal(mono.quantity,6);
 assert.ok(Object.values(mono.crew).every(n=>n>0));

 // Abrir busca livre no catálogo enquanto Configurar no orçamento está aberto.
 const global=page.getByRole('region',{name:'Serviços cadastrados e SINAPI'});
 await global.getByLabel('Buscar composição SINAPI para o serviço').fill('100860');
 await global.getByRole('group',{name:'Escolher composição SINAPI'})
  .getByRole('button',{name:/SINAPI 100860/}).waitFor({timeout:13000});
 assert.ok(queries.some(q=>q.includes('chuveiro'))&&queries.some(q=>q.includes('monof'))&&queries.some(q=>q.includes('100860')));
 // Recuperar tarefa criada antes como "sem HH": mantém id, quantidade e progresso.
 store.payload.schedules[0].tasks.push({
  id:'etapa-pendente-qa',quantity:1,crew:{},quoteItemId:undefined,
  composition:{code:'101494',unit:'UN',
   description:'ENTRADA DE ENERGIA ELÉTRICA MONOFÁSICA, CABO 16 MM2 — pendente',
   sourceFile:'SINPRES (catálogo textual)',sourceSheet:'Busca online',labor:[]},
  notes:'Etapa anterior pendente'
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
  .getByRole('button',{name:'Cronograma'}).click();
 const pending=page.getByRole('region',{name:'Etapas SINAPI pendentes de horas-homem'});
 await pending.getByRole('button',{name:/Buscar HH do código 101494 no Supabase/}).click();
 await pending.getByRole('button',{name:/Aplicar coeficientes analíticos/}).waitFor({timeout:13000});
 await pending.getByLabel('UF para etapas pendentes').selectOption('SP');
 await pending.getByLabel('Encargos para etapas pendentes').selectOption('sem_desoneracao');
 await pending.getByRole('button',{name:/Aplicar coeficientes analíticos/}).click();
 await page.waitForTimeout(1000);
 assert.equal(store.payload.schedules[0].tasks.length,3);
 const restored=store.payload.schedules[0].tasks.find(t=>t.id==='etapa-pendente-qa');
 assert.equal(restored.composition.code,'101494');
 assert.equal(restored.composition.reference,'09/2026');
 assert.equal(restored.composition.uf,'SP');
 assert.ok(restored.composition.labor.length>0,'A tarefa pendente deve recuperar as HH da biblioteca');
 assert.ok(Object.values(restored.crew).every(n=>n>0),'Equipe simulada usa coeficientes reais');
 assert.equal(restored.quantity,1);
 assert.equal(store.payload.schedules[0].tasks[0].quoteItemId,'qa-chuveiro');
 assert.equal(store.payload.schedules[0].tasks[1].quoteItemId,'qa-mono');
 assert.deepEqual(errors,[]);
 console.log('PASS SINAPI 09/2026 no Android: 9.136 no Supabase; orçamento 22 chuveiros/6 padrões; restauração de HH em etapa pendente; vínculos intactos');
} finally {await browser.close();}
