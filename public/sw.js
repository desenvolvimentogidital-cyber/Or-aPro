// OrçaPro PWA. Only the public offline page is stored.
// NEVER cache login/session/workspace JSON, API responses, quotations, or HTML
// that may include shared proposal query parameters. All navigations are online-first.
const CACHE='orcapro-public-offline-v1';
const OFFLINE='/offline.html';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add(OFFLINE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys
      .filter(name=>name.startsWith('orcapro-public-offline-')&&name!==CACHE)
      .map(name=>caches.delete(name)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  // No interception of Supabase, /api/, scripts, styles or subresources.
  if(request.mode!=='navigate'||request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(fetch(request).catch(async()=>{
    const stored=await caches.open(CACHE);
    return await stored.match(OFFLINE) || Response.error();
  }));
});
