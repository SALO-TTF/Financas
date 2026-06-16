// Service Worker da Klaco — permite instalar a app e funcionar offline (básico).
const CACHE_NOME = "klaco-v1";
const FICHEIROS = ["/", "/index.html", "/manifest.json"];

// Instala e guarda os ficheiros essenciais
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(FICHEIROS))
  );
  self.skipWaiting();
});

// Limpa caches antigos quando há nova versão
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes.filter((n) => n !== CACHE_NOME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Serve do cache quando offline, senão vai à rede
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(evento.request))
  );
});
