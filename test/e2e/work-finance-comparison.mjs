import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Isolated browser test: no Supabase, real money, or production workspace.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const quote={id:'quote-1',number:'#QA-18',clientId:'c',clientName:'Cliente QA',
  status:'aprovado',date:'2026-10-11',validUntil:'2026-12-01',
  items:[{id:'mat',name:'Material',type:'material',unit:'UN',quantity:10,
    unitCost:40,costConfirmed:true,unitPrice:100,totalPrice:1000},
    {id:'labor',name:'Execução',type:'servico',unit:'UN',quantity:1,
    unitPrice:1000,totalPrice:1000,costConfirmed:false}],total:2000,subtotal:2000};
const work=(id,title)=>({id,title,startDate:'2026-10-11',
  quoteId:'quote-1',hoursPerDay:8,efficiency:1,tasks:[],
  createdAt:'2026-10-11T12:00:00Z',updatedAt:'2026-10-11T12:00:00Z'});
const fixture={revision:1,payload:{
 quotes:[quote],clients:[],catalog:[],expenses:[],
 company:{name:'Construtora QA',tradeName:'Construtora QA'},
 notifications:[],schedules:[work('s1','Obra da Vila'),work('s2','Obra da Escola')],
 financeEntries:[{id:'old',type:'despesa',date:'2026-10-11',amount:75,
  description:'Pagamento antigo sem obra',category:'Materiais',
  quoteId:'quote-1',createdAt:'2026-10-11T11:00:00Z'}],lastQuoteNumber:18
}};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
  'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
 access_token:'qa-only',refresh_token:'qa-only',expires_at:Date.now()+3600000,
 user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
})));
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,
  body:JSON.stringify([{revision:fixture.revision,payload:fixture.payload}])});
 const data=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH'&&data.revision===fixture.revision+1){
   fixture.revision=data.revision;fixture.payload=structuredClone(data.payload);
   return route.fulfill({status:200,headers,body:JSON.stringify([{revision:fixture.revision}])});
 }
 return route.fulfill({status:409,headers,body:'{"error":"Unexpected revision"}'});
});
async function waitStore(count){
 const end=Date.now()+10000;
 while(fixture.payload.financeEntries.length!==count){
   if(Date.now()>end)throw Error('Finance entry count not saved: '+fixture.payload.financeEntries.length);
   await page.waitForTimeout(125);
 }
}
async function open(){
 await page.getByRole('navigation',{name:'Navegação Principal'})
  .getByRole('button',{name:'Mais'}).click();
 await page.getByRole('button',{name:/Recebimentos e despesas/}).click();
 await page.getByRole('heading',{name:'Controle financeiro real'}).waitFor();
 return page.getByRole('region',{name:'Comparativo financeiro por obra'});
}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const summary=await open();
 await summary.getByLabel('Selecionar obra para comparar custos').selectOption('s1');
 await summary.getByText(/item\(ns\) do orçamento sem custo confirmado/).waitFor();
 await summary.getByText(/lançamento\(s\) de.*75,00.*sem obra identificada/).waitFor();
 assert.match(await summary.innerText(),/R\$\s*400,00/);
 // Real payment for Obra da Vila: budget is selected automatically, never double-count s2.
 await page.getByLabel('Vincular movimentação a uma obra').selectOption('s1');
 assert.equal(await page.getByLabel('Orçamento da movimentação').inputValue(),'quote-1');
 await page.getByLabel('Valor (R$)').fill('550,00');
 await page.getByLabel('Categoria').fill('Pagamento de cliente');
 await page.getByLabel('Descrição').fill('Adiantamento obra Vila');
 await page.getByRole('button',{name:'Salvar movimentação real'}).click();
 await waitStore(2);
 assert.equal(fixture.payload.financeEntries[0].scheduleId,'s1');
 assert.equal(fixture.payload.financeEntries[0].quoteId,'quote-1');
 assert.equal(fixture.payload.financeEntries[0].amount,550);
 await page.locator('form').locator('select').first().selectOption('despesa');
 await page.getByLabel('Vincular movimentação a uma obra').selectOption('s1');
 await page.getByLabel('Valor (R$)').fill('200');
 await page.getByLabel('Categoria').fill('Materiais');
 await page.getByLabel('Descrição').fill('Compra de cimento para Vila');
 await page.getByRole('button',{name:'Salvar movimentação real'}).click();
 await waitStore(3);
 const first=await summary.innerText();
 assert.match(first,/R\$\s*550,00/);
 assert.match(first,/R\$\s*200,00/);
 assert.match(first,/R\$\s*350,00/);
 await summary.getByLabel('Selecionar obra para comparar custos').selectOption('s2');
 const second=await summary.innerText();
 assert.match(second,/R\$\s*400,00/);
 assert.match(second,/R\$\s*0,00/);
 assert.doesNotMatch(second,/R\$\s*350,00/,'do not mix cash across two works sharing quote');
 await page.reload({waitUntil:'domcontentloaded'});
 const again=await open();
 await again.getByLabel('Selecionar obra para comparar custos').selectOption('s1');
 assert.match(await again.innerText(),/R\$\s*350,00/);
 assert.equal(fixture.payload.financeEntries.length,3);
 assert.deepEqual(errors,[]);
 console.log('PASS mobile finance: per-work actual receipts, expenses and known costs; partial warnings; cloud persistence, no mistaken sharing of one quote');
}finally{await browser.close();}
