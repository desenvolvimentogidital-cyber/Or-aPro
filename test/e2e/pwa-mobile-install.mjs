import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Real Chromium + isolated local Vite server. This never reads user accounts.
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:3000/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},
  userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const manifest=await page.locator('link[rel=manifest]').getAttribute('href');
  assert.equal(manifest,'/manifest.webmanifest');
  const descriptor=await (await page.request.get(base+'manifest.webmanifest')).json();
  assert.equal(descriptor.display,'standalone');
  assert.equal(descriptor.start_url,'/');
  for(const icon of descriptor.icons){
    const response=await page.request.get(new URL(icon.src,base).href);
    assert.equal(response.status(),200,'Install icon must be served: '+icon.src);
    const bytes=await response.body();
    assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
  }
  const install=page.getByRole('button',{name:'Instalar aplicativo OrçaPro no celular'});
  await install.waitFor();
  await install.click();
  const dialog=page.getByRole('dialog',{name:'Instalar OrçaPro'});
  await dialog.waitFor();
  assert.match(await dialog.innerText(),/Instalar app|Adicionar à tela inicial/);
  assert.match(await dialog.innerText(),/internet/);
  await dialog.getByRole('button',{name:'Entendi'}).click();

  // Simulate the real Chromium event, including browser activation.
  await page.evaluate(()=>{
    window.__qaPwaPrompts=0;
    const event=new Event('beforeinstallprompt',{cancelable:true});
    Object.defineProperty(event,'prompt',{value:async()=>{window.__qaPwaPrompts++;}});
    Object.defineProperty(event,'userChoice',{value:Promise.resolve({outcome:'accepted'})});
    window.dispatchEvent(event);
  });
  await install.click();
  assert.equal(await page.evaluate(()=>window.__qaPwaPrompts),1,'Install button must call the actual browser prompt');
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await install.waitFor({state:'detached'});

  // Even when offline, no cached account data is returned.
  const worker=await page.evaluate(async()=>{
    const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    await navigator.serviceWorker.ready;
    return {scope:reg.scope,active:reg.active?.state};
  });
  assert.ok(worker.scope.endsWith('/'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  const cache=await page.evaluate(async()=>({keys:await caches.keys(),
    offline:!!(await caches.match('/offline.html')),
    private:!!(await caches.match('/rest/v1/orcapro_workspaces'))}));
  assert.ok(cache.keys.includes('orcapro-public-offline-v1'));
  assert.equal(cache.offline,true);
  assert.equal(cache.private,false);
  // DevTools network emulation can still return cached Vite HTML (with empty
  // body when JS is offline); offline fallback is tested deterministically
  // with a simulated service-worker fetch event in test/pwa-install.test.mjs.
  const offlinePage=await (await page.request.get(base+'offline.html')).text();
  assert.match(offlinePage,/OrçaPro está sem internet/);
  assert.match(offlinePage,/precisa de conexão/);
  assert.deepEqual(errors,[]);
  console.log('PASS Android PWA: manifest+PNG, real install prompt, instructions, service worker without private data and clear offline notice');
}finally{await browser.close();}
