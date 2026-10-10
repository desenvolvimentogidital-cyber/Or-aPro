import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Mock isolado: não conecta à conta Supabase ou a serviços reais.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const now='2026-10-10T10:00:00Z';
const fixture={revision:1,payload:{
  quotes:[],clients:[],
  catalog:[{id:'cat-qa',name:'Chuveiro',type:'servico',category:'Elétrica',unit:'un',price:180}],
  expenses:[{id:'exp-qa',name:'Funcionários',category:'Fixo',amount:15000}],
  company:{name:'Empresa QA',tradeName:'Empresa QA'},
  notifications:[],financeEntries:[],lastQuoteNumber:0,
  schedules:[{id:'obra-qa',title:'Obra QA',startDate:'2026-10-10',hoursPerDay:8,
    efficiency:1,createdAt:now,updatedAt:now,tasks:[]}]
}};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
  'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
  access_token:'qa-token',refresh_token:'qa-token',expires_at:Date.now()+3600000,
  user:{id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid'}
})));
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(req.method()==='GET')return route.fulfill({status:200,headers,
    body:JSON.stringify([{payload:fixture.payload,revision:fixture.revision}])});
  const body=JSON.parse(req.postData()||'{}');
  if(req.method()==='PATCH'&&body.revision===fixture.revision+1){
    fixture.payload=structuredClone(body.payload);fixture.revision=body.revision;
    return route.fulfill({status:200,headers,body:JSON.stringify([{revision:fixture.revision}])});
  }
  return route.fulfill({status:409,headers,body:JSON.stringify({error:'Conflito QA'})});
});
async function openFromMore(button){
  await page.getByRole('navigation',{name:'Navegação Principal'}).getByRole('button',{name:'Mais'}).click();
  await page.getByRole('button',{name:button,exact:true}).click();
}
try {
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await openFromMore('Serviços');
  await page.getByRole('button',{name:'Editar Chuveiro'}).click();
  const price=page.getByPlaceholder('0.00');
  await price.waitFor();
  assert.equal(await price.inputValue(),'180');
  await price.click();
  await page.waitForTimeout(120);
  const selection=await price.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,value:el.value}));
  assert.equal(selection.start,0,'Toque seleciona início do preço');
  assert.equal(selection.end,3,'Toque seleciona valor completo do preço');

  await price.press('Backspace');
  assert.equal(await price.inputValue(),'','Backspace apaga tudo mesmo se valor antigo for 180');
  assert.equal(fixture.payload.catalog[0].price,180,'O preço não deve mudar ao limpar o rascunho');
  await price.fill('450,75');
  assert.equal(await price.inputValue(),'450,75','Vírgula decimal fica durante a digitação');
  await price.press('Tab');
  assert.equal(await price.inputValue(),'450.75','Ao confirmar o editor converte vírgula para ponto');
  await page.getByRole('button',{name:'Atualizar Item'}).click();
  await page.waitForTimeout(1200);
  assert.equal(fixture.payload.catalog[0].price,450.75,'Preço confirmado é sincronizado');

  await openFromMore('Formação de Preço & Markup');
  await page.getByRole('button',{name:/Quanto Preciso Cobrar/}).click();
  const material=page.getByText('Custo de Materiais (R$)').locator('..').locator('input');
  await material.fill('0,50');
  assert.equal(await material.inputValue(),'0,50');
  await material.press('Tab');
  assert.equal(await material.inputValue(),'0.5','Formação de preço permite decimal mesmo começando em zero');
  await material.click();
  await page.waitForTimeout(120);
  await material.press('Backspace');
  assert.equal(await material.inputValue(),'');
  await material.press('Tab');
  assert.equal(await material.inputValue(),'','Campo opcional pode ser esvaziado sem voltar 0 na tela');

  await page.getByRole('navigation',{name:'Navegação Principal'}).getByRole('button',{name:'Cronograma'}).click();
  const hours=page.getByLabel('Jornada em horas por dia');
  await hours.waitFor();
  assert.equal(await hours.inputValue(),'8');
  await hours.click();
  await page.waitForTimeout(120);
  assert.equal(await hours.evaluate(el=>el.selectionStart),0);
  await hours.press('Backspace');
  assert.equal(await hours.inputValue(),'');
  assert.equal(fixture.payload.schedules[0].hoursPerDay,8,'Apagar rascunho não salva uma jornada inválida');
  await hours.fill('7,5');
  await hours.press('Tab');
  assert.equal(await hours.inputValue(),'7.5');
  await page.waitForTimeout(1200);
  assert.equal(fixture.payload.schedules[0].hoursPerDay,7.5);

  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('navigation',{name:'Navegação Principal'}).getByRole('button',{name:'Cronograma'}).click();
  assert.equal(await page.getByLabel('Jornada em horas por dia').inputValue(),'7.5');
  assert.deepEqual(errors,[],'Nenhum erro JavaScript');
  console.log('PASS Android: preço, valores de formação de preço e jornada numérica podem ser selecionados, apagados e substituídos com vírgula decimal; salvos após confirmar.');
}finally{await browser.close();}
