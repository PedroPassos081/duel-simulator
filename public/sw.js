// Service worker do Master Duelist: só para as notificações de duelo
// (duelo encontrado, seu turno). Não guarda nada em cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Tocar na notificação volta para a aba do jogo (ou abre a página do duelo)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/random";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) {
          tab.navigate(url).catch(() => {});
          return tab.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
