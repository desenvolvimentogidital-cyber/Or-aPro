import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const fixture={revision:1,payload:{
  quotes:[],clients:[],catalog:[],expenses:[
    {id:'e1',name:'Funcionários',category:'Fixo',amount:15000},
    {id:'e2',name:'Telefone',category:'Fixo',amount:200},
    {id:'e3',name:'Internet',category:'Fixo',amount:500},
    {id:'e4',name:'Outras despesas',category:'Fixo',amount:500}
  ],company:{name:'Empresa de QA',tradeName:'Empresa de QA'},
  notifications:[],financeEntries:[],schedules:[],lastQuoteNumber:0
}};
const headers={
 'content-type':'application/json','access-control-allow-origin':'*',
 'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'
};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
  sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
    access_token:'qa-fake',refresh_token:'qa-fake',expires_at:Date.now()+3600000,
    user:{id:'00000000-0000-4000-8000-000000000001',email:'pricing-qa@example.invalid'}
  }));
});
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(req.method()==='GET')return route.fulfill({
    status:200,headers,body:JSON.stringify([{payload:fixture.payload,revision:fixture.revision}])
  });
  const body=JSON.parse(req.postData()||'{}');
  if(req.method()==='PATCH'&&body.revision===fixture.revision+1){
    fixture.payload=structuredClone(body.payload);
    fixture.revision=body.revision;
    return route.fulfill({status:200,headers,body:JSON.stringify([{revision:fixture.revision}])});
  }
  return route.fulfill({status:409,headers,body:'{"error":"Conflito de revisão QA"}'});
});

const openPricing=async()=>{
  await page.getByRole('navigation',{name:'Navegação Principal'})
    .getByRole('button',{name:'Mais'}).click();
  await page.getByRole('button',{name:'Formação de Preço & Markup'}).click();
  await page.getByRole('heading',{name:'Formação de Preço'}).waitFor();
  return page.getByRole('region',{name:'Configurar jornada de trabalho mensal'});
};

try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const panel=await openPricing();
  await panel.waitFor();
  assert.equal(await panel.getByLabel('Dias trabalhados por mês').inputValue(),'');
  assert.equal(await panel.getByLabel('Horas trabalhadas por dia').inputValue(),'');
  await panel.getByText(/Informe os dias trabalhados no mês/).waitFor();
  assert.equal(await page.getByText('R$ 16.200,00').isVisible(),true);
  assert.equal(await page.getByRole('alert').count(),0,'Sem aviso vermelho antes de informar a jornada');

  await panel.getByLabel('Dias trabalhados por mês').fill('22');
  await panel.getByLabel('Horas trabalhadas por dia').fill('8');
  await panel.getByText(/176 horas no mês/).waitFor();
  await panel.getByText(/Custo de cada hora: R\$ 92,05/).waitFor();
  await page.getByText('R$ 736,36').waitFor();
  await page.getByText('R$ 92,05').first().waitFor();
  await page.waitForTimeout(1400);
  assert.equal(fixture.payload.company.pricingWorkDaysPerMonth,22);
  assert.equal(fixture.payload.company.pricingHoursPerDay,8);
  assert.ok(fixture.revision>=2,'Dados de jornada devem persistir na nuvem');

  await page.reload({waitUntil:'domcontentloaded'});
  const again=await openPricing();
  assert.equal(await again.getByLabel('Dias trabalhados por mês').inputValue(),'22');
  assert.equal(await again.getByLabel('Horas trabalhadas por dia').inputValue(),'8');
  await again.getByText(/176 horas no mês/).waitFor();
  await page.getByRole('button',{name:/Quanto Preciso Cobrar/}).click();
  await page.getByText('Preço Recomendado de Venda').waitFor();

  await again.getByLabel('Horas trabalhadas por dia').fill('0');
  await again.getByText(/Informe os dias trabalhados no mês/).waitFor();
  await again.getByLabel('Horas trabalhadas por dia').fill('8');
  await page.setViewportSize({width:320,height:740});
  await page.waitForTimeout(350);
  const width=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(width<=322,'Não deve haver rolagem horizontal no Android 320px: '+width);
  assert.deepEqual(errors,[]);
  console.log('PASS: jornada 22 × 8 = 176h; custos 16200; persistência após login/reload; Android 320/390; nenhum erro JS');
}finally{
  await browser.close();
}
