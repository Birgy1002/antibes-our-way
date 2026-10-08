const VERSION='2.0';
const CACHE=`antibes-our-way-v${VERSION}`;
const APP_SHELL=[
  './',
  './index.html',
  './style.css?v=2.0',
  './app.js?v=2.0',
  './data/places.js?v=2.0',
  './data/gastro.js?v=2.0',
  './data/plans.js?v=2.0',
  './data/events.js?v=2.0',
  './manifest.webmanifest?v=2.0',
  './assets/icon-192.png?v=2.0',
  './assets/icon-512.png?v=2.0'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('antibes-our-way-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // Event radar is updated frequently: always fetch fresh data first.
  // Offline users retain the last successfully loaded radar.
  if(url.pathname.endsWith('/data/events.js')){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(request,{cache:'no-store'});
        if(!fresh.ok) throw new Error('Event radar unavailable');
        const cache=await caches.open(CACHE);
        await cache.put(request,fresh.clone());
        return fresh;
      }catch(err){
        return (await caches.match(request)) || Response.error();
      }
    })());
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(request,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put('./index.html',fresh.clone()).catch(()=>{});
        return fresh;
      }catch(err){
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached) return cached;
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  })());
});
