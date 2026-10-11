// Astra Maths moved to https://philhandley.github.io/astra-maths/
// This retires the old service worker that served it from this folder, then reloads its pages so they follow the redirect.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
