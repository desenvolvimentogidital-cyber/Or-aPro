import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Simula Android + Supabase com API interceptada. Coeficientes extraídos da planilha SINAPI 09/2026
// fornecida para auditoria. Nenhum dado real de usuário é alterado.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const now='2026-10-10T12:00:00Z';
const user='00000000-0000-4000-8000-000000000001';
const quote={id:'q-sinapi-sep',number:'#QA-2026-09',clientId:'qa',clientName:'Cliente de teste',
  status:'rascunho',date:'2026-10-10',validUntil:'2026-12-01',
  items:[{id:'chuveiro-22',name:'Chuveiro',unit:'un',type:'servico',quantity:22,
    unitPrice:120,totalPrice:2640}],subtotal:2640,total:2640,discountType:'fixed',
  discountValue:0,taxRate:0,targetMarginRate:0,travelCost:0,otherCosts:0,netProfit:0,
  modelTemplate:'padrao',visibility:{}};
const company={name:'Empresa QA',tradeName:'Empresa QA'};
const state={revision:1,payload:{quotes:[quote],clients:[],catalog:[],expenses:[],notifications:[],
  schedules:[{id:'obra-qa',title:'Obra QA',quoteId:quote.id,startDate:'2026-10-10',hoursPerDay:8,
    efficiency:1,tasks:[],createdAt:now,updatedAt:now}],financeEntries:[],lastQuoteNumber:1,
  company}};
const library=[];
const headers={'content-type':'application/json','access-control-allow-origin':'*',
 'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS',
 'access-control-expose-headers':'Content-Range'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
await page.addInitScript(id=>sessionStorage.setItem('orcapro_cloud_session',
  JSON.stringify({access_token:'fake-token',refresh_token:'fake-token',expires_at:Date.now()+3600000,
    user:{id,email:'qa@example.invalid'}})),user);
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,
   body:JSON.stringify([{payload:state.payload,revision:state.revision}])});
 const body=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH'&&body.revision===state.revision+1){
   state.payload=structuredClone(body.payload);state.revision=body.revision;
   return route.fulfill({status:200,headers,body:JSON.stringify([{revision:state.revision}])});
 }
 return route.fulfill({status:409,headers,body:'{"error":"Conflito QA"}'});
});
await page.route('**/rest/v1/orcapro_sinapi_compositions**',route=>{
 const req=route.request();
 if(req.method()==='GET')return route.fulfill({status:206,
   headers:{...headers,'Content-Range':`0-0/${library.length}`},body:'[]'});
 if(req.method()==='POST'){
   for(const row of JSON.parse(req.postData()||'[]')){
     assert.equal(row.user_id,user,'Dados nunca podem ser importados em outra conta');
     assert.equal(row.reference,'09/2026');
     const idx=library.findIndex(c=>c.code===row.code&&c.reference===row.reference);
     if(idx>=0)library[idx]=row;else library.push(row);
   }
   return route.fulfill({status:201,headers,body:''});
 }
 return route.fulfill({status:405,headers,body:'{}'});
});
await page.route('**/rest/v1/rpc/orcapro_find_sinapi',route=>{
 const q=(JSON.parse(route.request().postData()||'{}').p_query||'').toLowerCase();
 const result=library.filter(c=>(c.code+' '+c.description).toLowerCase().includes(q))
   .map(c=>({code:c.code,description:c.description,unit:c.unit,labor:c.labor,
     sourceFile:c.source_file,sourceSheet:c.source_sheet,reference:c.reference}));
 return route.fulfill({status:200,headers,body:JSON.stringify(result)});
});
await page.route('**/api/sinapi-search?*',route=>route.fulfill({
  status:200,headers,body:JSON.stringify({data:[],source:'SINPRES'})}));
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
  .getByRole('button',{name:'Cronograma'}).click();
 const picker=page.getByLabel('Importar planilha SINAPI');
 await page.getByPlaceholder('MM/AAAA').fill('09/2026');
 const csv=[
 'Código Composição;Descrição Composição;Unidade Composição;Código Insumo;Descrição Insumo;Unidade Insumo;Coeficiente;Tipo',
 '100860;CHUVEIRO ELÉTRICO COMUM CORPO PLÁSTICO - FORNECIMENTO E INSTALAÇÃO;UN;88316;SERVENTE COM ENCARGOS COMPLEMENTARES;H;0,4535436;COMPOSICAO',
 '100860;CHUVEIRO ELÉTRICO COMUM CORPO PLÁSTICO - FORNECIMENTO E INSTALAÇÃO;UN;88267;ENCANADOR OU BOMBEIRO HIDRÁULICO COM ENCARGOS COMPLEMENTARES;H;1,1816004;COMPOSICAO',
 '91996;TOMADA MÉDIA DE EMBUTIR (1 MÓDULO), 2P+T 10 A;UN;88264;ELETRICISTA COM ENCARGOS COMPLEMENTARES;H;0,445;COMPOSICAO',
 '91996;TOMADA MÉDIA DE EMBUTIR (1 MÓDULO), 2P+T 10 A;UN;88247;AUXILIAR DE ELETRICISTA COM ENCARGOS COMPLEMENTARES;H;0,445;COMPOSICAO'
 ].join('\n');
 await picker.setInputFiles({name:'analitico-sinapi-09-2026.csv',mimeType:'text/csv',
   buffer:Buffer.from(csv)});
 await page.getByText(/Biblioteca de 2 composições salva/).waitFor({timeout:20000});
 assert.equal(library.length,2);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
  .getByRole('button',{name:'Cronograma'}).click();
 const quoteArea=page.getByRole('region',{name:'Do orçamento para o cronograma'});
 await quoteArea.getByRole('button',{name:/Chuveiro/}).click();

 const compositionSelect=quoteArea.getByLabel(/Confirme a composição adequada/);
 await compositionSelect.locator('option').filter({hasText:/^100860 /}).first().waitFor({timeout:13000});
 const selectedKey=await compositionSelect.locator('option').filter({hasText:/^100860 /}).first().getAttribute('value');
 assert.ok(selectedKey);
 await compositionSelect.selectOption(selectedKey);
 await page.getByLabel('UF da referência').selectOption('SP');
 await page.getByLabel('Encargos SINAPI').selectOption('sem_desoneracao');
 await quoteArea.getByText(/HH/).first().waitFor();
 await quoteArea.getByRole('button',{name:'Adicionar etapa com equipe simulada'}).click();
 await page.waitForTimeout(1400);
 assert.equal(state.payload.schedules[0].tasks.length,1,'Deve criar a etapa no cronograma real');
 const task=state.payload.schedules[0].tasks[0];
 assert.equal(task.composition.code,'100860');
 assert.equal(task.composition.reference,'09/2026');
 assert.equal(task.composition.uf,'SP');
 assert.equal(task.composition.regime,'sem_desoneracao');
 assert.equal(task.quantity,22);
 assert.equal(task.quoteItemId,'chuveiro-22');
 assert.equal(task.composition.labor.length,2);
 assert.ok(Object.values(task.crew).every(n=>n>0));
 const hh=task.composition.labor.reduce((n,l)=>n+l.hoursPerUnit*task.quantity,0);
 assert.ok(Math.abs(hh-35.973168)<0.0001,hh);
 assert.deepEqual(errors,[]);
 console.log('PASS setembro/2026: CSV analítico salvo no Supabase simulado; busca por Chuveiro após recarga; 35,97 HH e etapa associada ao orçamento');
}finally{await browser.close();}
