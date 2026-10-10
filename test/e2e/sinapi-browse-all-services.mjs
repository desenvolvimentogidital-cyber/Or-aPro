import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Android: busca de TODA a biblioteca (sem baixar 9.136 registros), cadastro,
// orçamento e HH reais do SINAPI. Somente API simulada em memória.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const electrical={code:'91991',description:'TOMADA ALTA DE EMBUTIR (1 MÓDULO), 2P+T 20 A, SEM SUPORTE E SEM PLACA - FORNECIMENTO E INSTALAÇÃO. AF_03/2023',
  unit:'UN',reference:'09/2026',sourceFile:'SINAPI_Referência_2026_09.xlsx',sourceSheet:'Analítico',
  labor:[{code:'88264',role:'ELETRICISTA COM ENCARGOS COMPLEMENTARES',hoursPerUnit:0.511},
    {code:'88247',role:'AUXILIAR DE ELETRICISTA COM ENCARGOS COMPLEMENTARES',hoursPerUnit:0.511}]};
const hydraulic={code:'100860',description:'CHUVEIRO ELÉTRICO COMUM CORPO PLÁSTICO, TIPO DUCHA - FORNECIMENTO E INSTALAÇÃO. AF_02/2026',
  unit:'UN',reference:'09/2026',sourceFile:electrical.sourceFile,sourceSheet:'Analítico',
  labor:[{code:'88316',role:'SERVENTE COM ENCARGOS COMPLEMENTARES',hoursPerUnit:0.4535436},
    {code:'88267',role:'ENCANADOR OU BOMBEIRO HIDRÁULICO COM ENCARGOS COMPLEMENTARES',hoursPerUnit:1.1816004}]};
const filler=Array.from({length:65},(_,i)=>({...electrical,code:String(300000+i),
 description:'INSTALAÇÃO ELÉTRICA DE TESTE '+i}));
const fixture={revision:1,payload:{quotes:[],clients:[{id:'cliente-qa',name:'Cliente QA',email:'',phone:''}],
  catalog:[],expenses:[],notifications:[],financeEntries:[],
  company:{name:'Empresa QA',tradeName:'Empresa QA',state:'SP'},schedules:[],lastQuoteNumber:0}};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
  'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[],browseCalls=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
  access_token:'isolated-qa',refresh_token:'isolated-qa',expires_at:Date.now()+3600000,
  user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
})));
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,
   body:JSON.stringify([{payload:fixture.payload,revision:fixture.revision}])});
 const data=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH'&&data.revision===fixture.revision+1){
   fixture.payload=structuredClone(data.payload);fixture.revision=data.revision;
   return route.fulfill({status:200,headers,body:JSON.stringify([{revision:fixture.revision}])});
 }
 return route.fulfill({status:409,headers,body:'{"error":"Conflito QA"}'});
});
await page.route('**/rest/v1/rpc/orcapro_browse_sinapi',route=>{
 const req=JSON.parse(route.request().postData()||'{}');
 browseCalls.push(req);
 const q=String(req.p_query||'').toLowerCase();
 const source=q.includes('91991')||q.includes('tomada')?[electrical]:
   q.includes('100860')||q.includes('chuveiro')?[hydraulic]:filler;
 const list=req.p_category==='eletrica'?source.filter(x=>x.code!=='100860'):
   req.p_category==='hidraulica'?source.filter(x=>x.code==='100860'):source;
 const total=q?list.length:req.p_category==='eletrica'?980:9136;
 const pageData=list.slice(req.p_offset,req.p_offset+req.p_limit)
   .map(entry=>({...entry,category:entry.code==='100860'?'hidraulica':'eletrica',total_count:total}));
 return route.fulfill({status:200,headers,body:JSON.stringify(pageData)});
});
await page.route('**/rest/v1/rpc/orcapro_sinapi_library_count',route=>
 route.fulfill({status:200,headers,body:'9136'}));
await page.route('**/rest/v1/rpc/orcapro_find_sinapi',route=>
 route.fulfill({status:200,headers,body:'[]'}));
await page.route('**/api/sinapi-search?*',route=>
 route.fulfill({status:200,headers,body:'{"data":[]}'}));
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const nav=page.getByRole('navigation',{name:'Navegação Principal'});
 await nav.getByRole('button',{name:'Mais'}).click();
 await page.getByRole('button',{name:'Serviços',exact:true}).click();
 await page.getByRole('button',{name:'Adicionar serviço da tabela SINAPI'}).click();
 const picker=page.getByRole('region',{name:'Biblioteca SINAPI de serviços'});
 await picker.getByText(/9.136 serviço\(s\) encontrado\(s\)/).waitFor({timeout:13000});
 assert.equal(await picker.getByRole('group',{name:'Resultados dos serviços SINAPI'}).getByRole('button').count(),30);
 await picker.getByRole('button',{name:'Mostrar mais serviços SINAPI'}).click();
 await picker.getByText(/mostrando 60/).waitFor({timeout:13000});
 assert.ok(browseCalls.some(x=>x.p_offset===30 && x.p_limit===30));
 await picker.getByLabel('Categoria dos serviços SINAPI').selectOption('eletrica');
 await picker.getByText(/980 serviço\(s\) encontrado\(s\)/).waitFor({timeout:13000});
 await picker.getByLabel('Pesquisar serviços da tabela SINAPI').fill('91991');
 await picker.getByRole('button',{name:/Selecionar SINAPI 91991/}).waitFor({timeout:13000});
 await picker.getByRole('button',{name:/Selecionar SINAPI 91991/}).click();
 await page.getByLabel('Encargos para o serviço SINAPI').selectOption('sem_desoneracao');
 assert.equal(await page.getByLabel('UF para o serviço SINAPI').inputValue(),'SP');
 const price=page.getByPlaceholder('0.00');await price.fill('180');await price.press('Tab');
 await page.getByRole('button',{name:'Salvar Item'}).click();
 await page.waitForTimeout(1200);
 assert.equal(fixture.payload.catalog.length,1);
 const registered=fixture.payload.catalog[0];
 assert.equal(registered.price,180);
 assert.equal(registered.sinapiComposition.code,'91991');
 assert.equal(registered.sinapiComposition.reference,'09/2026');
 assert.equal(registered.sinapiComposition.uf,'SP');
 assert.equal(registered.sinapiComposition.regime,'sem_desoneracao');
 assert.equal(registered.sinapiComposition.labor.length,2);

 // Orçamento também pode escolher qualquer composição da base global,
 // mesmo sem estar cadastrada no catálogo pessoal.
 await nav.getByRole('button',{name:'Orçamentos'}).click();
 await page.getByTitle('Novo Orçamento').click();
 await page.getByRole('button',{name:'Adicionar item'}).click();
 await page.getByRole('button',{name:/Adicionar serviço da tabela SINAPI \(todos os 9.136\)/}).click();
 const quotePicker=page.getByRole('region',{name:'Biblioteca SINAPI de serviços'});
 await quotePicker.getByLabel('Pesquisar serviços da tabela SINAPI').fill('100860');
 await quotePicker.getByRole('button',{name:/Selecionar SINAPI 100860/}).click();
 await page.getByLabel('Encargos da composição SINAPI no orçamento').selectOption('sem_desoneracao');
 const sale=page.getByLabel('Preço de venda do serviço SINAPI');
 await sale.fill('240');await sale.press('Tab');
 await page.getByRole('button',{name:'Adicionar serviço SINAPI ao orçamento'}).click();
 await page.getByText(/SINAPI 100860.*HH referenciais/).waitFor({timeout:13000});
 await page.waitForTimeout(1200);
 assert.equal(fixture.payload.catalog.length,2,'Composição escolhida no orçamento também é salva no catálogo');
 assert.equal(fixture.payload.catalog[1].sinapiComposition.code,'100860');
 assert.deepEqual(errors,[]);
 console.log('PASS Android: todos 9.136 buscáveis/paginados, 980 elétricos, cadastro com preço declarado e HH, inclusão no orçamento sem preço inventado');
}finally{await browser.close();}
