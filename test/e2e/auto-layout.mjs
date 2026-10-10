import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Apenas uma sessão fictícia e resposta REST em memória, sem acessar Supabase hospedado.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const session={access_token:'ui-device-only',refresh_token:'ui-device-only',expires_at:Date.now()+3600000,
 user:{id:'00000000-0000-4000-8000-000000000001',email:'device@example.invalid'}};
const task={id:'t1',composition:{code:'QA-01',description:'Alvenaria QA - painel responsivo',
  unit:'m²',sourceFile:'SINAPI_TEST_ONLY',sourceSheet:'Analítico',reference:'08/2026',
  labor:[{code:'001',role:'Pedreiro',hoursPerUnit:0.5}]},
  quantity:100,crew:{'001:Pedreiro':1},progress:[]};
const schedule={id:'qa-responsive',title:'Obra de homologação responsiva',startDate:'2026-10-09',
  hoursPerDay:8,efficiency:1,tasks:[task],createdAt:'2026-10-09T10:00:00Z',updatedAt:'2026-10-09T10:00:00Z'};
const payload={quotes:[],clients:[],catalog:[],expenses:[],company:{name:'Empresa QA',tradeName:'Empresa QA'},
  notifications:[],schedules:[schedule],financeEntries:[],lastQuoteNumber:0};
const browser=await chromium.launch({headless:true});
try{
 const authPage=await browser.newPage({viewport:{width:375,height:812}});
 await authPage.goto(base,{waitUntil:'domcontentloaded'});
 await authPage.getByRole('heading',{name:'Bem-vindo de volta'}).waitFor();
 const password=authPage.locator('#orcapro-auth-password');
 assert.equal(await password.getAttribute('type'),'password');
 await authPage.getByRole('button',{name:'Mostrar senha'}).click();
 assert.equal(await password.getAttribute('type'),'text','Exibir senha sem alterar autenticacao');
 await authPage.getByRole('button',{name:'Ocultar senha'}).click();
 assert.equal(await password.getAttribute('type'),'password');
 await authPage.getByRole('button',{name:'Criar conta'}).click();
 await authPage.getByRole('heading',{name:'Crie sua conta'}).waitFor();
 await authPage.getByRole('button',{name:'Esqueci minha senha'}).click();
 await authPage.getByRole('heading',{name:'Recupere o acesso'}).waitFor();
 const authWidth=await authPage.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(authWidth<=375,'Login mobile nao pode gerar rolagem horizontal');
 await authPage.close();
 console.log('PASS login, cadastro e recuperacao adaptados ao telefone');
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(v=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify(v)),session);
 await page.route('**/rest/v1/orcapro_workspaces**',async route=>{
   const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
   return route.fulfill({status:200,headers,body:JSON.stringify([{payload,revision:1}])});
 });
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const bottom=page.getByRole('navigation',{name:'Navegação Principal'});
 const side=page.getByRole('navigation',{name:'Navegação desktop'});
 const overview=page.getByRole('region',{name:'Painel executivo do cronograma'});
 const assertPhone=async width=>{
   await page.setViewportSize({width,height:844});
   await bottom.waitFor({state:'visible'});
   // O container possui uma transicao CSS: medir apenas depois de estabilizar.
   await page.waitForFunction(w=>{
     const main=document.querySelector('main');
     return !!main&&Math.abs(main.getBoundingClientRect().width-w)<3;
   },width,{timeout:5000});
   assert.equal(await side.isVisible().catch(()=>false),false,'Sidebar desktop nao pode aparecer em '+width);
   const main=await page.locator('main').boundingBox();
   assert.ok(main,'main deve estar visivel');
   assert.ok(Math.abs(main.width-width)<3,'A versão celular deve ocupar toda largura: '+width+', mediu '+main.width);
   assert.ok(main.height < 844,'A versão celular não deve impor altura fictícia de 860px em '+width);
   const totalWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
   assert.ok(totalWidth<=width+2,'Rolagem horizontal global em '+width+': '+totalWidth);
 };
 await assertPhone(390);
 await assertPhone(320);
 await assertPhone(390);
 await bottom.getByRole('button',{name:'Cronograma'}).click();
 await overview.waitFor({timeout:12000});
 await overview.getByText('Cronograma de obras').waitFor();
 assert.equal(await page.getByRole('link',{name:'Editar planejamento'}).isVisible(),true);
 const preferences=page.getByRole('region',{name:'Referências de custos e reajuste'});
 await preferences.waitFor();
 await preferences.getByLabel('Base referencial de serviços').selectOption('SICRO');
 await preferences.getByLabel('Índice de reajuste').selectOption('INCC');
 await preferences.getByText(/este módulo ainda não consulta ou importa automaticamente/).waitFor();
 assert.equal(await preferences.getByLabel('Base referencial de serviços').inputValue(),'SICRO');
 assert.equal(await preferences.getByLabel('Índice de reajuste').inputValue(),'INCC');
 await preferences.getByLabel('Base referencial de serviços').selectOption('OUTRA');
 await preferences.getByLabel('Nome da base personalizada').fill('Tabela municipal de referência QA');
 assert.equal(await preferences.getByLabel('Nome da base personalizada').inputValue(),'Tabela municipal de referência QA');
 await preferences.getByLabel('Base referencial de serviços').selectOption('SINAPI');
 await preferences.getByLabel('Índice de reajuste').selectOption('NENHUM');
 console.log('PASS mobile: SICRO/INCC, referência personalizada e retorno ao SINAPI');
 const gantt=page.getByRole('region',{name:'Gantt mensal do planejamento'});
 await gantt.waitFor();
 assert.equal(await gantt.getAttribute('tabindex'),'0','Gantt deve permitir navegacao por teclado');
 const details=page.getByRole('region',{name:'Tabela de serviços e prazos do cronograma'});
 assert.equal(await details.getAttribute('tabindex'),'0','Detalhamento precisa ser rolavel pelo teclado');
 await overview.getByRole('button',{name:'Gerar relatório PDF'}).click();
 const preview=page.getByRole('region',{name:'Prévia do relatório do cronograma'});
 await preview.waitFor({state:'visible'});
 const openReport=preview.getByRole('link',{name:/Abrir relatório em nova aba/});
 await openReport.waitFor({state:'visible'});
 assert.equal(await openReport.getAttribute('target'),'_blank');
 assert.match(await openReport.getAttribute('href')||'',/^blob:/,'O PDF deve poder abrir como documento local');
 await preview.getByRole('button',{name:'Fechar prévia'}).click();
 await preview.waitFor({state:'hidden'});
 await mkdir('artifacts',{recursive:true});
 await page.screenshot({path:'artifacts/orcapro-cronograma-auto-mobile.png',fullPage:true});
 await assertPhone(375);
 await assertPhone(430);
 await assertPhone(767);
 console.log('PASS mobile tela cheia 320 / 375 / 390 / 430 / 767 com Gantt e PDF acessiveis');

 await page.setViewportSize({width:768,height:960});
 await bottom.waitFor({state:'visible'});
 assert.equal(await side.isVisible().catch(()=>false),false,'Tablet 768 sem sidebar ate 1024');
 await page.setViewportSize({width:1440,height:900});
 await side.waitFor({state:'visible'});
 assert.equal(await bottom.isVisible(),false,'Navegacao inferior nao deve aparecer no desktop');
 await overview.waitFor();
 await page.waitForFunction(()=>{
   const main=document.querySelector('main');
   return !!main&&main.getBoundingClientRect().width>1000;
 },undefined,{timeout:5000});
 const wide=await page.locator('main').boundingBox();
 assert.ok(wide.width>1000,'Cronograma web precisa de area ampla, mediu '+wide.width);
 await page.screenshot({path:'artifacts/orcapro-cronograma-auto-web.png',fullPage:true});
 console.log('PASS web 1440 com sidebar e cronograma em formato amplo');

 await page.getByRole('button',{name:'Celular'}).click();
 await bottom.waitFor({state:'visible'});
 assert.equal(await side.isVisible(),false,'Preview de celular deve ocultar sidebar');
 // A troca Celular/Fluido tem transição CSS de 300ms; aguardar a moldura estabilizar.
 await page.waitForTimeout(450);
 const sim=await page.locator('main').boundingBox();
 assert.ok(sim.width>=390&&sim.width<=425,'Simulacao de celular desktop manteve moldura de 420px; largura medida='+sim.width);
 await page.getByRole('button',{name:'Fluido'}).click();
 await side.waitFor({state:'visible'});
 console.log('PASS alternancia manual de visualizacao desktop continua disponivel');

 await page.setViewportSize({width:390,height:844});
 await assertPhone(390);
 await overview.waitFor();
 assert.deepEqual(errors,[],'Erro JS na alteracao automatica de layout');
 console.log('PASS troca automatica de volta ao mobile sem perda de cronograma');
}finally{await browser.close();}
