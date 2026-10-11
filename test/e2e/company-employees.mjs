import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const fixture={revision:1,payload:{quotes:[],clients:[],catalog:[],
  expenses:[{id:'internet',name:'Internet',category:'Fixo',amount:500}],
  company:{name:'QA Empresa',tradeName:'QA Empresa',state:'PR',
    pricingWorkDaysPerMonth:22,pricingHoursPerDay:8},
  notifications:[],financeEntries:[],schedules:[],lastQuoteNumber:0}};
const headers={'content-type':'application/json','access-control-allow-origin':'*',
 'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify({
 access_token:'qa-token',refresh_token:'qa-token',expires_at:Date.now()+3600000,
 user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}
})));
await page.route('**/rest/v1/orcapro_workspaces**',route=>{
 const req=route.request();
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(req.method()==='GET')return route.fulfill({status:200,headers,
  body:JSON.stringify([{revision:fixture.revision,payload:fixture.payload}])});
 const body=JSON.parse(req.postData()||'{}');
 if(req.method()==='PATCH'&&body.revision===fixture.revision+1){
   fixture.payload=structuredClone(body.payload);fixture.revision=body.revision;
   return route.fulfill({status:200,headers,body:JSON.stringify([{revision:fixture.revision}])});
 }
 return route.fulfill({status:409,headers,body:'{"error":"Unexpected revision"}'});
});
await page.route('**/rest/v1/rpc/orcapro_sinapi_worker_roles',route=>
 route.fulfill({status:200,headers,body:JSON.stringify([
  {code:'88264',role:'ELETRICISTA COM ENCARGOS COMPLEMENTARES',compositions_count:1000},
  {code:'88316',role:'SERVENTE COM ENCARGOS COMPLEMENTARES',compositions_count:4000}
 ])}));
await page.route('**/rest/v1/orcapro_sinapi_unit_costs?*',route=>
 route.fulfill({status:200,headers,body:'[]'}));
await page.route('**/rest/v1/orcapro_sinapi_published_unit_costs?*',route=>{
 const u=new URL(route.request().url());
 const code=u.searchParams.get('code');
 const arr=code==='eq.88264'?[{unit:'H',source_file:'SINAPI 09/2026 CSD/CCD',
    costs_in_cents:{com_desoneracao:{PR:4025},sem_desoneracao:{PR:4263}}}]:[];
 return route.fulfill({status:200,headers,body:JSON.stringify(arr)});
});
async function open(){
 await page.getByRole('navigation',{name:'Navegação Principal'})
   .getByRole('button',{name:'Mais'}).click();
 await page.getByRole('button',{name:'Formação de Preço & Markup'}).click();
 await page.getByRole('heading',{name:'Formação de Preço'}).waitFor();
 return page.getByRole('region',{name:'Funcionários e equipe'});
}
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const staff=await open();
 await staff.getByText('Nenhum funcionário cadastrado ainda.').waitFor();
 await staff.getByPlaceholder('Ex.: Eletricista João ou Funcionário 01').fill('Eletricista da empresa');
 await staff.getByRole('combobox',{name:'Profissão SINAPI do funcionário'}).selectOption('88264');
 await staff.getByRole('combobox',{name:'Encargos SINAPI do funcionário'}).selectOption('com_desoneracao');
 await staff.getByText(/Referência SINAPI \\(custo com encargos\\):/).waitFor({timeout:10000})
  .catch(async err=>{throw Error('Referência não encontrada: '+String(await staff.innerText()).slice(0,1700)+'; '+err.message);});
 assert.match(await staff.innerText(),/40,25/);
 await staff.getByRole('combobox',{name:'Forma de pagamento'}).selectOption('hourly');
 await staff.getByRole('button',{name:/Usar referência por hora/}).click();
 assert.equal(await staff.getByLabel('Pagamento por hora do funcionário').inputValue(),'40.25');
 await staff.getByLabel('Horas previstas do funcionário no mês').fill('100');
 await staff.getByRole('button',{name:'Salvar funcionário'}).click();
 await staff.getByText('Eletricista da empresa').waitFor();
 await page.waitForTimeout(1300);
 assert.equal(fixture.payload.company.employees.length,1);
 assert.equal(fixture.payload.company.employees[0].paymentBasis,'hourly');
 assert.equal(fixture.payload.company.employees[0].paymentAmount,40.25);
 assert.equal(fixture.payload.financeEntries.length,0,'Cadastro não cria pagamento fictício');
 assert.equal(fixture.payload.expenses.length,1,'Não duplica salários no cadastro de despesas');

 await staff.getByPlaceholder('Ex.: Eletricista João ou Funcionário 01').fill('Mestre mensalista');
 await staff.getByPlaceholder('Ex.: Mestre de obras').fill('Mestre de obras');
 await staff.getByLabel('Pagamento mensal do funcionário').fill('3500');
 await staff.getByLabel('Benefícios e encargos adicionais mensais').fill('500');
 await staff.getByRole('button',{name:'Salvar funcionário'}).click();
 await page.waitForTimeout(1500);
 assert.equal(fixture.payload.company.employees.length,2);
 const electrician=fixture.payload.company.employees.find(e=>e.sinapiCode==='88264');
 assert.ok(electrician?.reference);
 assert.equal(electrician.reference.hourlyCost,40.25);
 assert.ok(fixture.payload.company.employees.some(e=>e.name==='Mestre mensalista'&&e.paymentAmount===3500));

 await page.reload({waitUntil:'domcontentloaded'});
 const again=await open();
 await again.getByText('Eletricista da empresa').waitFor();
 await again.getByText('Mestre mensalista').waitFor();
 await page.getByText('R$ 4.500,00').first().waitFor();
 await page.getByText('R$ 4.025,00').first().waitFor();
 await again.getByRole('button',{name:'Editar funcionário Mestre mensalista'}).click();
 assert.equal(await again.getByLabel('Pagamento mensal do funcionário').inputValue(),'3500');
 await again.getByLabel('Pagamento mensal do funcionário').fill('3700');
 await again.getByRole('button',{name:'Atualizar funcionário'}).click();
 await page.waitForTimeout(1300);
 assert.equal(fixture.payload.company.employees.find(e=>e.name==='Mestre mensalista').paymentAmount,3700);
 assert.deepEqual(errors,[]);
 console.log('PASS Android employees: SINAPI hourly cost vs editable pay, monthly fixed + hourly forecast, no duplicate cash, cloud persistence and edit');
}finally{await browser.close();}
