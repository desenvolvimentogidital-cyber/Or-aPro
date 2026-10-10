import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Navegador Android simulado, API REST e SINPRES totalmente interceptados.
// Dados de teste FICTÍCIOS, nenhum código / HH aqui pertence ao SINAPI real.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const today='2026-10-10T12:00:00Z';
const quote={
  id:'quote-online-qa',number:'#QA-002',clientId:'client-qa',clientName:'Cliente fictício',
  status:'rascunho',date:'2026-10-09',validUntil:'2026-12-01',
  items:[
    {id:'item-chuveiro',name:'Chuveiro',unit:'un',type:'servico',quantity:22,unitPrice:100,totalPrice:2200},
    {id:'item-padrao',name:'Padrão monofásico',unit:'un',type:'servico',quantity:6,unitPrice:100,totalPrice:600}
  ],
  subtotal:2800,total:2800,netProfit:0,travelCost:0,otherCosts:0,
  discountType:'fixed',discountValue:0,taxRate:0,targetMarginRate:0,
  modelTemplate:'padrao',visibility:{}
};
const data={revision:1,payload:{
  quotes:[quote],clients:[],catalog:[
    {id:'cat-chuveiro',name:'Chuveiro',type:'servico',unit:'un',category:'Elétrica',price:100},
    {id:'cat-padrao',name:'Padrão monofásico',type:'servico',unit:'un',category:'Elétrica',price:100}
  ],
  expenses:[],notifications:[],company:{name:'Empresa QA',tradeName:'Empresa QA'},
  schedules:[{id:'qa-obra-online',title:'Obra fictícia — elétrica',startDate:'2026-10-09',
    hoursPerDay:8,efficiency:1,tasks:[],quoteId:quote.id,createdAt:today,updatedAt:today}],
  financeEntries:[],lastQuoteNumber:2
}};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
  'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
let searches=0;
await page.addInitScript(()=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
  access_token:'qa-session',refresh_token:'qa-session',expires_at:Date.now()+3600000,
  user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
})));
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(req.method()==='GET')return route.fulfill({status:200,headers,body:JSON.stringify([{payload:data.payload,revision:data.revision}])});
  const body=JSON.parse(req.postData()||'{}');
  if(req.method()==='PATCH'&&body.revision===data.revision+1){
    data.payload=structuredClone(body.payload);data.revision=body.revision;
    return route.fulfill({status:200,headers,body:JSON.stringify([{revision:data.revision}])});
  }
  return route.fulfill({status:409,headers,body:JSON.stringify({error:'Conflito de revisão QA'})});
});
await page.route('**/api/sinapi-search?*',route=>{
  searches++;
  const q=new URL(route.request().url()).searchParams.get('q')?.toLowerCase()||'';
  const data=q.includes('chuveiro')?[
    {code:'990001',description:'INSTALAÇÃO DE CHUVEIRO (DADO FICTÍCIO QA)',unit:'UN'}
  ]:q.includes('monofasico')||q.includes('monofásico')?[
    {code:'990002',description:'PADRÃO DE ENTRADA MONOFÁSICO (DADO FICTÍCIO QA)',unit:'UN'}
  ]:[];
  return route.fulfill({status:200,headers,body:JSON.stringify({data,source:'SINPRES'})});
});
try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'Navegação Principal'});
  await nav.getByRole('button',{name:'Cronograma'}).click();
  const quoteRegion=page.getByRole('region',{name:'Do orçamento para o cronograma'});
  await quoteRegion.waitFor();
  await quoteRegion.getByRole('button',{name:/Chuveiro/}).first().click();
  await quoteRegion.getByRole('button',{name:/Pesquisar este serviço no catálogo SINAPI online/}).click();
  const online=page.getByRole('region',{name:'Resultados da consulta online SINAPI'});
  await online.getByRole('group',{name:'Selecionar composição SINAPI online'})
    .getByRole('button',{name:/SINAPI 990001/}).waitFor({timeout:12000});
  await online.getByRole('group',{name:'Selecionar composição SINAPI online'})
    .getByRole('button',{name:/SINAPI 990001/}).click();
  assert.equal(await online.getByLabel('Quantidade SINAPI online').inputValue(),'22');
  await online.getByRole('button',{name:'Registrar composição como etapa pendente de HH'}).click();
  await page.waitForTimeout(900);
  assert.equal(data.payload.schedules[0].tasks.length,1);
  const task=data.payload.schedules[0].tasks[0];
  assert.equal(task.quantity,22);
  assert.equal(task.composition.code,'990001');
  assert.deepEqual(task.composition.labor,[],'A consulta online não pode inventar HH');
  assert.deepEqual(task.crew,{},'A consulta online não pode inventar equipe');
  assert.equal(task.quoteItemId,'item-chuveiro');
  assert.equal(data.payload.catalog[0].sinapiComposition,undefined,'Não validar como analítico um catálogo sem HH');
  await page.getByRole('region',{name:'Etapas SINAPI pendentes de horas-homem'})
    .getByText(/Aguardando fonte analítica/).waitFor();
  console.log('PASS Chuveiro: 22 un do orçamento vira etapa pendente com código pesquisado online');

  // Independente do clique no serviço, a busca textual permanece acessível.
  const global=page.getByRole('region',{name:'Serviços cadastrados e SINAPI'});
  const field=global.getByLabel('Buscar composição SINAPI para o serviço');
  await field.fill('padrão monofásico');
  await online.getByRole('group',{name:'Selecionar composição SINAPI online'})
    .getByRole('button',{name:/SINAPI 990002/}).waitFor({timeout:12000});
  assert.ok(searches>=2);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Navegação Principal'}).getByRole('button',{name:'Cronograma'}).click();
  await page.getByRole('region',{name:'Etapas SINAPI pendentes de horas-homem'}).waitFor();
  assert.equal(data.payload.schedules[0].tasks.length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS busca online de Chuveiro e Padrão monofásico em Android mock, persistência sem HH inventadas');
} finally {await browser.close();}
