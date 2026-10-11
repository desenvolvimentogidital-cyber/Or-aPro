import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=process.cwd();
const manifest=JSON.parse(readFileSync(join(root,'public/manifest.webmanifest'),'utf8'));
const sw=readFileSync(join(root,'public/sw.js'),'utf8');
const html=readFileSync(join(root,'index.html'),'utf8');
const vercel=JSON.parse(readFileSync(join(root,'vercel.json'),'utf8'));
const pack=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));

test('OrçaPro is a genuine installable PWA manifest scoped to root',()=>{
  assert.equal(manifest.name,'OrçaPro — Orçamentos e Obras');
  assert.equal(manifest.short_name,'OrçaPro');
  assert.equal(manifest.id,'/');
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.scope,'/');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.prefer_related_applications,false);
  assert.ok(manifest.icons.some(i=>i.sizes==='192x192'&&i.type==='image/png'));
  assert.ok(manifest.icons.some(i=>i.sizes==='512x512'&&i.type==='image/png'));
  assert.ok(manifest.icons.some(i=>i.purpose==='maskable'));
  assert.match(html,/rel="manifest"/);
  assert.match(html,/apple-touch-icon/);
  assert.match(html,/theme-color/);
});

test('branded PNG icons are real square raster images generated without external dependencies',()=>{
  execFileSync(process.execPath,['scripts/generate-pwa-icons.mjs'],{cwd:root});
  for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]){
    const path=join(root,'public/icons',name);
    assert.ok(existsSync(path));
    const bytes=readFileSync(path);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),size);
    assert.equal(bytes.readUInt32BE(20),size);
    assert.ok(bytes.length>500,'PNG must contain real pixels');
  }
  assert.match(pack.scripts.predev,/generate-pwa-icons/);
  assert.match(pack.scripts.prebuild,/generate-pwa-icons/);
});

test('service worker always fetches data online and never caches private content',()=>{
  assert.match(sw,/request.mode!=='navigate'/);
  assert.match(sw,/fetch\(request,\{cache:'no-store'\}\)\.catch/);
  assert.match(sw,/cache\.add\(OFFLINE\)/);
  assert.doesNotMatch(sw,/cache\.put\(request/);
  assert.doesNotMatch(sw,/addAll\(\['\/'\]/);
  assert.match(readFileSync(join(root,'public/offline.html'),'utf8'),/precisa de conexão/);
  assert.match(readFileSync(join(root,'src/main.tsx'),'utf8'),/import\.meta\.env\.PROD/);
  assert.ok(vercel.headers.some(h=>h.source==='/sw.js'&&h.headers.some(e=>e.key==='Cache-Control'&&e.value.includes('no-store'))));
});

test('service worker returns explicit offline page on network failure and never intercepts API calls',async()=>{
  const callbacks=new Map();
  const cached=new Map([['/offline.html',new Response('OrçaPro está sem internet',{headers:{'content-type':'text/html'}})]]);
  const cache={add:async()=>{},match:async key=>cached.get(key)};
  let networkCalls=0;
  const worker={
    location:{origin:'https://or-a-pro-seven.vercel.app'},
    addEventListener:(type,handler)=>callbacks.set(type,handler),
    clients:{claim:async()=>{}},skipWaiting:async()=>{}
  };
  runInNewContext(sw,{self:worker,URL,Response,Promise,
    caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},
    fetch:async(request,options)=>{
      networkCalls++;
      assert.equal(options.cache,'no-store');
      throw new Error('internet offline');
    }
  });
  let answer;
  callbacks.get('fetch')({
    request:{mode:'navigate',method:'GET',url:'https://or-a-pro-seven.vercel.app/?proposta=public-token'},
    respondWith:promise=>{answer=promise;}
  });
  assert.equal((await (await answer).text()),'OrçaPro está sem internet');
  assert.equal(networkCalls,1);
  let intercepted=false;
  callbacks.get('fetch')({
    request:{mode:'cors',method:'POST',url:'https://or-a-pro-seven.vercel.app/rest/v1/orcapro_workspaces'},
    respondWith:()=>{intercepted=true;}
  });
  assert.equal(intercepted,false,'Authenticated API requests must bypass service worker');
});
