const CACHE_NOME="klaco-v1";const FICHEIROS=["/","/index.html","/manifest.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NOME).then(c=>c.addAll(FICHEIROS)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ns=>Promise.all(ns.filter(n=>n!==CACHE_NOME).map(n=>caches.delete(n)))));self.clients.claim();});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
