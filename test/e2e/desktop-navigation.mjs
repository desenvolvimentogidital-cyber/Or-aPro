import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Harness VISUAL isolado: token ficticio, GET do workspace interceptado.
// Nao valida persistencia real e nao grava dados em Supabase.
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000/';
const fakeSession = {
  access_token:'ui-visual-test-only',
  refresh_token:'ui-visual-test-only',
  expires_at: Date.now()+2*60*60*1000,
  user:{id:'00000000-0000-4000-8000-000000000001',email:'visual@example.test'}
};
const browser = await chromium.launch({headless:true});
async function openWorkspace(viewport) {
  const page = await browser.newPage({viewport});
  await page.addInitScript(s => sessionStorage.setItem('orcapro_cloud_session',JSON.stringify(s)),fakeSession);
  await page.route('**/rest/v1/orcapro_workspaces?**',route => {
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH','content-type':'application/json'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
    return route.fulfill({status:200,headers,body:'[]'});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByText('Dados na nuvem').waitFor({timeout:15000});
  return page;
}
try {
  const desktop = await openWorkspace({width:1440,height:900});
  const nav = desktop.getByRole('navigation',{name:'Navegação desktop'});
  await nav.waitFor();
  assert.equal(await nav.isVisible(),true,'navegacao lateral desktop visivel');
  await nav.getByRole('button',{name:'Financeiro'}).click();
  await desktop.getByRole('heading',{name:'Controle financeiro real'}).waitFor();
  await nav.getByRole('button',{name:'Clientes'}).click();
  await desktop.getByRole('heading',{name:'Clientes',exact:true}).waitFor();
  await mkdir('artifacts',{recursive:true});
  await desktop.screenshot({path:'artifacts/orcapro-desktop.png',fullPage:true});
  console.log('PASS desktop 1440: sidebar e mudanca entre modulos');
  await desktop.close();

  const mobile = await openWorkspace({width:390,height:844});
  const bottom = mobile.getByRole('navigation',{name:'Navegação Principal'});
  assert.equal(await bottom.isVisible(),true,'barra mobile deve ficar visivel');
  assert.equal(await mobile.getByRole('navigation',{name:'Navegação desktop'}).count(),0,'sem sidebar no modo mobile');
  await bottom.getByRole('button',{name:'Clientes'}).click();
  await mobile.getByRole('heading',{name:'Clientes',exact:true}).waitFor();
  await mobile.screenshot({path:'artifacts/orcapro-mobile.png',fullPage:true});
  console.log('PASS mobile 390: navegacao inferior preservada');
  await mobile.close();
} finally {await browser.close();}
