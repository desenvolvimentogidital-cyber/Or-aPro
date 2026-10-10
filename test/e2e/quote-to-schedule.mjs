import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Fluxo real de UI, com API REST em memória. NENHUM dado chega ao Supabase do usuário.
const origin=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const quote={
 id:'quote-qa',number:'#QA-100',clientId:'cli-qa',clientName:'Cliente FICTICIO de testes',
 clientPhone:'',clientEmail:'',date:'2026-10-09',validUntil:'2026-12-01',status:'rascunho',
 items:[
 {id:'item-alvenaria',name:'Alvenaria de vedação de blocos',unit:'m²',type:'servico',quantity:100,unitPrice:80,totalPrice:8000},
 {id:'item-porcelanato',name:'Revestimento de piso porcelanato',unit:'m²',type:'servico',quantity:500,unitPrice:90,totalPrice:45000},
 {id:'item-drywall',name:'Divisória drywall',unit:'m²',type:'servico',quantity:250,unitPrice:120,totalPrice:30000},
 {id:'item-pintura',name:'Pintura acrílica de paredes',unit:'m²',type:'servico',quantity:600,unitPrice:25,totalPrice:15000}
 ],subtotal:98000,total:98000,netProfit:0,travelCost:0,otherCosts:0,
 discountType:'fixed',discountValue:0,taxRate:0,targetMarginRate:0,modelTemplate:'padrao',
 visibility:{showServices:true,showMaterials:true,showQuantities:true,showUnitPrices:true,showTaxes:false,showProfitMargin:false,showDiscount:true,showTotal:true,showTerms:true,showPix:false,showSignature:false}
};
const store={
 payload:{quotes:[quote],clients:[],catalog:[],expenses:[],company:{name:'Empresa QA',tradeName:'Empresa QA',phone:'',email:'',whatsapp:'',document:'',address:'',city:'',state:'',logoUrl:'',tagline:'',pixKey:'',pixType:'CPF',bankInfo:'',signatureName:'',termsAndConditions:''},notifications:[],financeEntries:[],schedules:[],lastQuoteNumber:100},
 revision:1
};
const csv=[
'Código Composição;Descrição Composição;Unidade Composição;Código Insumo;Descrição Insumo;Unidade Insumo;Coeficiente;Tipo',
'100001;Alvenaria de vedação de blocos;m²;001;Pedreiro;H;0,5;Mão de Obra',
'100001;Alvenaria de vedação de blocos;m²;002;Servente;H;0,25;Mão de Obra',
'100003;Piso porcelanato assentado;m²;003;Azulejista;H;0,6;Mão de Obra',
'100003;Piso porcelanato assentado;m²;002;Servente;H;0,3;Mão de Obra',
'100004;Divisória drywall em chapas;m²;004;Montador;H;0,3;Mão de Obra',
'100004;Divisória drywall em chapas;m²;002;Servente;H;0,1;Mão de Obra',
'100005;Pintura acrílica de paredes;m²;005;Pintor;H;0,1;Mão de Obra',
'100005;Pintura acrílica de paredes;m²;002;Servente;H;0,05;Mão de Obra'
].join('\r\n');
// Coeficientes deste CSV são FICTÍCIOS e nunca representam valores SINAPI oficiais.
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
   access_token:'fake-browser-ui',refresh_token:'fake-browser-ui',expires_at:Date.now()+3600000,
   user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
 }));
});
const headers={'access-control-allow-origin':'*','content-type':'application/json','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,body:JSON.stringify([{payload:store.payload,revision:store.revision}])});
 const body=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH' && body.revision===store.revision+1){
    store.payload=structuredClone(body.payload);store.revision=body.revision;
    return route.fulfill({status:200,headers,body:JSON.stringify([{revision:store.revision}])});
 }
 return route.fulfill({status:200,headers,body:'[]'});
});
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 const nav=page.getByRole('navigation',{name:'Navegação desktop'});
 await nav.waitFor();
 await nav.getByRole('button',{name:'Orçamentos'}).click();
 await page.getByRole('button',{name:'Planejar obra'}).click();
 await page.getByRole('heading',{name:'Cronograma de execução'}).waitFor();
 assert.equal(await page.getByLabel('Vincular a um orçamento existente').inputValue(),quote.id);
 await page.locator('input[type=file][accept*=".xlsx"]').setInputFiles({
   name:'coeficientes-ficticios-qa.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')
 });
 await page.getByText(/Total: 4 serviço/).waitFor({timeout:15_000});
 await page.getByPlaceholder('MM/AAAA').fill('08/2026');
 await page.getByLabel('UF da referência').selectOption('SP');
 await page.getByLabel('Encargos SINAPI').selectOption('sem_desoneracao');
 for(const [label,code,expectedQuantity] of [
  ['Alvenaria de vedação de blocos','100001',100],
  ['Revestimento de piso porcelanato','100003',500],
  ['Divisória drywall','100004',250],
  ['Pintura acrílica de paredes','100005',600]
 ]){
   const region=page.getByRole('region',{name:'Do orçamento para o cronograma'});
   await region.getByRole('button',{name:new RegExp(label)}).first().click();
   const selector=region.getByLabel(/Confirme a composição adequada/);
   const key=await selector.locator('option').filter({hasText:new RegExp('^'+code+'\\b')}).first().getAttribute('value');
   assert.ok(key,'Composição esperada ausente: '+code);
   await selector.selectOption(key);
   await region.getByLabel(/Prazo desejado em dias úteis/).fill('10');
   await region.getByRole('button',{name:'Adicionar etapa com equipe simulada'}).click();
   await page.getByText('Este item já está ligado', {exact:false}).first().waitFor({timeout:3000}).catch(()=>{});
   const schedules=store.payload.schedules||[];
   const task=schedules[0]?.tasks?.find(t=>t.composition.code===code);
   // React debounce: dados podem ainda estar somente na tela.
   await page.waitForTimeout(850);
   const persisted=store.payload.schedules?.[0]?.tasks?.find(t=>t.composition.code===code);
   assert.equal(persisted?.quantity,expectedQuantity);
   assert.ok(persisted?.quoteItemId,'vinculo para fisico-financeiro ausente');
   assert.ok(Object.values(persisted.crew).every(x=>x>0));
   console.log('PASS conversao do item do orcamento '+label);
 }
 await page.reload({waitUntil:'domcontentloaded'});
 await nav.getByRole('button',{name:'Cronograma SINAPI'}).click();
 await page.getByRole('heading',{name:'Etapas e equipes'}).waitFor();
 assert.equal(store.payload.schedules[0].tasks.length,4);
 assert.deepEqual(errors,[]);
 console.log('PASS 4 etapas, vínculo financeiro e equipes persistidas apos reload, sem acessar Supabase');
} finally { await browser.close(); }
