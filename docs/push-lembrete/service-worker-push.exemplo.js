// EXEMPLO — NÃO ACTIVO. Só para colar em public/service-worker.js quando o push existir (ver LEIA-ME.md).
self.addEventListener("push", (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (e) {}
  const titulo = dados.titulo || "Klaco";
  event.waitUntil(self.registration.showNotification(titulo, {
    body: dados.mensagem || "",
    icon: "/logo192.png",
    tag: dados.chave_evento || "klaco",   // a mesma chave substitui em vez de duplicar
    data: { url: "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
    for (const c of lista) { if ("focus" in c) return c.focus(); }
    return clients.openWindow((event.notification.data && event.notification.data.url) || "/");
  }));
});
