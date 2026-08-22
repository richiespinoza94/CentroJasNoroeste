// Service worker deliberadamente vacío de lógica de caché. Su único trabajo
// es existir y tener un listener de "fetch" — eso es lo que Chrome/Android
// pide para considerar la app "instalable" (ver criterios de instalabilidad
// de Chrome). No cachea nada a propósito: esta app depende de datos en
// tiempo real de Firestore, así que "modo offline" real no aplica, y cachear
// el HTML/JS agresivamente arriesgaría mostrarle a alguien una versión vieja
// de la app sin que se dé cuenta. Si más adelante se quiere soporte offline
// de verdad, esto es el punto de partida — no el final.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Sin caché: deja que cada petición vaya a la red como si no hubiera
  // service worker — solo existe para cumplir el requisito de instalabilidad.
});
