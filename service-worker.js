const VERSION='1.7';
const CACHE=`antibes-our-way-v${VERSION}`;
const APP_SHELL=[
  './',
  './index.html',
  './style.css?v=1.5',
  './v15.css?v=1.5',
  './app.js?v=1.5',
  './data/places.js?v=1.5',
  './data/gastro.js?v=1.5',
  './data/plans.js?v=1.5',
  './data/events.js?v=1.5',
  './manifest.webmanifest?v=1.5',
  './assets/icon-192.png?v=1.5',
  './assets/icon-512.png?v=1.5'
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
    const response=await fetch(request);
    if(response.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  })());
});
