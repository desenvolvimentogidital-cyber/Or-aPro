import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Teste SOMENTE local com REST simulado: verifica o calendário real da tela.
// Nenhum dado é enviado ao Supabase hospedado.
const browser=await chromium.launch({headless:true});
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const person='PEDREIRO COM ENCARGOS COMPLEMENTARES';
const schedule={
  id:'qa-calendario',title:'QA Cronograma visual',startDate:'2026-10-09',
  hoursPerDay:8,efficiency:1,holidays:['2026-10-12'],
  tasks:[
    {id:'qa1',composition:{code:'88309',description:'SERVICO COM DURACAO DE VINTE DIAS',unit:'M2',labor:[{code:'88309',role:person,hoursPerUnit:1}],sourceFile:'SINAPI_QA',sourceSheet:'Analitico',reference:'08/2026'},quantity:160,crew:{['88309:'+person]:1},progress:[]},
    {id:'qa2',composition:{code:'88310',description:'SEGUNDA ETAPA EXECUTIVA',unit:'M2',labor:[{code:'88309',role:person,hoursPerUnit:1}],sourceFile:'SINAPI_QA',sourceSheet:'Analitico',reference:'08/2026'},quantity:16,crew:{['88309:'+person]:1},progress:[]}
  ],
  createdAt:'2026-10-09T12:00:00Z',updatedAt:'2026-10-09T12:00:00Z'
};
const payload={quotes:[],clients:[],catalog:[],expenses:[],company:{name:'Empresa QA',tradeName:'Empresa QA'},notifications:[],schedules:[schedule],financeEntries:[],lastQuoteNumber:0};
const session={access_token:'qa-ui-only',refresh_token:'qa-ui-only',expires_at:Date.now()+7200000,user:{id:'00000000-0000-4000-8000-000000000001',email:'qa@example.invalid'}};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(s=>sessionStorage.setItem('orcapro_cloud_session',JSON.stringify(s)),session);
  await page.route('**/rest/v1/orcapro_workspaces?**',async route=>{
    const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    return route.fulfill({status:200,headers,body:JSON.stringify([{payload,revision:1}])});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const nav=page.getByRole('navigation',{name:'Navegação desktop'});
  await nav.getByRole('button',{name:'Cronograma SINAPI'}).click();
  const overview=page.getByRole('region',{name:'Painel executivo do cronograma'});
  await overview.waitFor({timeout:12000});
  await overview.getByText('Cronograma de obras').waitFor();
  await overview.getByText('Resumo das etapas e percentuais').waitFor();
  await overview.getByText('Gráfico de Gantt').waitFor();
  await overview.getByText('Curva S').waitFor();
  await overview.getByText('Não informado').first().waitFor();
  await overview.getByRole('button',{name:'Gerar relatório PDF'}).click();
  const preview=page.frameLocator('iframe[title="Prévia do cronograma para PDF"]');
  await preview.getByText('CRONOGRAMA DE OBRAS').waitFor();
  await preview.getByText('CURVA S').waitFor();
  await page.screenshot({path:'artifacts/cronograma-dashboard.png',fullPage:true}).catch(()=>{});
  const gantt=page.getByRole('region',{name:'Cronograma Gantt com datas e dias úteis'});
  await gantt.waitFor({timeout:12000});
  await gantt.getByText('D1',{exact:true}).waitFor();
  await gantt.getByText('09/10',{exact:true}).waitFor();
  await gantt.getByText('D15',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Próximos dias'}).click();
  await gantt.getByText('D16',{exact:true}).waitFor();
  await gantt.getByText('02/11',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Dias anteriores'}).click();
  await gantt.getByText('D1',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Preparar PDF'}).click();
  const print=page.frameLocator('iframe[title="Prévia do cronograma para PDF"]');
  await print.getByText('Planejamento visual · dias úteis 1 a 15').waitFor();
  await print.getByText('02/11',{exact:true}).first().waitFor();
  assert.deepEqual(errors,[],'Erros JS durante navegacao e geracao de PDF');
  console.log('PASS Gantt UI 09/10 a 02/11 (feriado e finais de semana excluidos), paginas e iframe PDF');
}finally{await browser.close();}
