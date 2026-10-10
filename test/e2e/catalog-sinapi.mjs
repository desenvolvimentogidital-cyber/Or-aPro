import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Simulação integralmente isolada: dados, custos e coeficientes FICTÍCIOS de QA;
// nenhuma requisição do teste é enviada ao Supabase real.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const now='2026-10-09T10:00:00Z';
const schedule={id:'obra-tomada-qa',title:'Obra QA (fictícia)',startDate:'2026-10-09',
  hoursPerDay:8,efficiency:1,tasks:[],createdAt:now,updatedAt:now};
const service={id:'cat-tomada-qa',name:'Instalar tomada na parede',type:'servico',
  category:'Elétrica',unit:'serviço',price:180,costConfirmed:false};
const store={revision:1,payload:{
  quotes:[],clients:[],catalog:[service],expenses:[],
  company:{name:'Empresa QA',tradeName:'Empresa QA'},
  notifications:[],schedules:[schedule],financeEntries:[],lastQuoteNumber:0
}};
const csv=[
'Código Composição;Descrição Composição;Unidade Composição;Código Insumo;Descrição Insumo;Unidade Insumo;Coeficiente;Tipo',
'100001;TOMADA DE EMBUTIR 2P+T 10A INCLUINDO SUPORTE E PLACA - FORNECIMENTO E INSTALAÇÃO;UN;99901;Eletricista;H;0,35;Mão de Obra',
'100001;TOMADA DE EMBUTIR 2P+T 10A INCLUINDO SUPORTE E PLACA - FORNECIMENTO E INSTALAÇÃO;UN;99902;Auxiliar de eletricista;H;0,22;Mão de Obra',
'100002;PONTO DE LUZ NO TETO;UN;99901;Eletricista;H;0,4;Mão de Obra'
].join('\r\n');

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const pageErrors=[];
page.on('pageerror',err=>pageErrors.push(err.message));
const headers={'access-control-allow-origin':'*','content-type':'application/json',
 'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
await page.addInitScript(()=>{
 sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
  access_token:'qa-fake-session',refresh_token:'qa-fake-session',expires_at:Date.now()+3600000,
  user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
 }));
});
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,
   body:JSON.stringify([{payload:store.payload,revision:store.revision}])});
 const body=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH' && body.revision===store.revision+1){
   store.payload=structuredClone(body.payload);store.revision=body.revision;
   return route.fulfill({status:200,headers,body:JSON.stringify([{revision:store.revision}])});
 }
 return route.fulfill({status:409,headers,body:JSON.stringify({error:'Conflito de revisão no QA'})});
});
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
   .getByRole('button',{name:'Cronograma'}).click();
 const region=page.getByRole('region',{name:'Serviços cadastrados e SINAPI'});
 await region.waitFor();
 // Regressão: Android deve abrir teclado para SINAPI mesmo sem serviço selecionado e sem dados carregados.
 const globalSearch=region.getByLabel('Buscar composição SINAPI para o serviço');
 assert.equal(await globalSearch.isEnabled(),true,'A busca SINAPI nunca pode ficar bloqueada');
 await globalSearch.fill('tomada');
 assert.equal(await globalSearch.inputValue(),'tomada');
 await region.getByText(/Ainda não existe uma base analítica carregada/).waitFor();
 await globalSearch.fill('');
 await region.getByRole('group',{name:'Selecionar serviço do catálogo'})
   .getByRole('button',{name:/Instalar tomada na parede/}).click();
 await region.getByText(/Ainda não há composições analíticas/).waitFor();
 await page.locator('input[type=file][accept*=".xlsx"]').setInputFiles({
   name:'sinapi-teste-ficticio.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')
 });
 await page.getByText(/Total: 2 serviço/).waitFor({timeout:15000});
 await page.getByPlaceholder('MM/AAAA').fill('08/2026');
 await page.getByLabel('UF da referência').selectOption('SP');
 await page.getByLabel('Encargos SINAPI').selectOption('sem_desoneracao');
 // Ao alternar de módulo para cadastrar mais serviços, a planilha deve continuar carregada.
 const mobileNav=page.getByRole('navigation',{name:'Navegação Principal'});
 await mobileNav.getByRole('button',{name:'Início'}).click();
 await mobileNav.getByRole('button',{name:'Cronograma'}).click();
 const reopened=page.getByRole('region',{name:'Serviços cadastrados e SINAPI'});
 await reopened.waitFor();
 assert.equal(await page.getByLabel('UF da referência').inputValue(),'SP');
 assert.equal(await page.getByLabel('Encargos SINAPI').inputValue(),'sem_desoneracao');
 await reopened.getByRole('group',{name:'Selecionar serviço do catálogo'})
   .getByRole('button',{name:/Instalar tomada na parede/}).click();
 await reopened.getByLabel('Buscar composição SINAPI para o serviço').fill('1000');
 assert.ok(await reopened.getByRole('group',{name:'Escolher composição SINAPI'}).getByRole('button',{name:/SINAPI 100001/}).isVisible(),
   'Prefixo de código SINAPI deve funcionar');
 await reopened.getByLabel('Buscar composição SINAPI para o serviço').fill('instalação tomada');
 await region.getByRole('group',{name:'Escolher composição SINAPI'})
   .getByRole('button',{name:/SINAPI 100001/}).click();
 await region.getByText(/unidade do catálogo é/).waitFor();
 await region.getByLabel('Quantidade na unidade SINAPI').fill('6');
 await region.getByRole('button',{name:/Adicionar etapa e salvar vínculo SINAPI/}).click();
 await region.getByRole('status').getByText(/Etapa criada/).waitFor();
 await page.waitForTimeout(1050);
 assert.equal(store.payload.schedules[0].tasks.length,1);
 assert.equal(store.payload.schedules[0].tasks[0].quantity,6);
 assert.equal(store.payload.schedules[0].tasks[0].composition.code,'100001');
 assert.equal(store.payload.schedules[0].tasks[0].quoteItemId,undefined,'unidades diferentes: sem vínculo financeiro');
 assert.equal(store.payload.catalog[0].price,180,'preço comercial inalterado');
 assert.equal(store.payload.catalog[0].sinapiComposition?.code,'100001');
 assert.equal(store.payload.catalog[0].sinapiComposition?.reference,'08/2026');
 assert.equal(store.payload.catalog[0].sinapiComposition?.uf,'SP');
 assert.equal(store.payload.catalog[0].sinapiComposition?.regime,'sem_desoneracao');
 console.log('PASS tomada: serviço salvo -> composição SINAPI selecionada -> HH e etapa no cronograma');

 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('navigation',{name:'Navegação Principal'})
   .getByRole('button',{name:'Cronograma'}).click();
 const again=page.getByRole('region',{name:'Serviços cadastrados e SINAPI'});
 await again.waitFor();
 const codeSearch=again.getByLabel('Buscar composição SINAPI para o serviço');
 assert.equal(await codeSearch.isEnabled(),true);
 await codeSearch.fill('100001');
 assert.ok(await again.getByRole('group',{name:'Escolher composição SINAPI'})
   .getByRole('button',{name:/SINAPI 100001/}).isVisible(),
   'Busca por código deve listar SINAPI já salvo, mesmo sem escolher serviço');
 await codeSearch.fill('');
 await again.getByRole('group',{name:'Selecionar serviço do catálogo'})
   .getByRole('button',{name:/Instalar tomada na parede/}).click();
 await again.getByRole('group',{name:'Escolher composição SINAPI'})
   .getByRole('button',{name:/SINAPI 100001/}).click();
 await again.getByLabel('Quantidade na unidade SINAPI').fill('4');
 await again.getByRole('button',{name:/Adicionar etapa e salvar vínculo SINAPI/}).click();
 await again.getByRole('status').getByText(/Etapa criada/).waitFor();
 await page.waitForTimeout(1000);
 assert.equal(store.payload.schedules[0].tasks.length,2);
 assert.equal(store.payload.schedules[0].tasks[1].quantity,4);
 assert.equal(store.payload.catalog[0].sinapiComposition?.labor?.length,2);
 assert.deepEqual(pageErrors,[]);
 console.log('PASS Android após login: reutiliza SINAPI salvo sem importar a planilha novamente');
}finally{await browser.close();}
