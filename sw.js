// Womo: Offline-Speicher. Die Notfallkarte (notfall.html) kommt immer sofort aus dem Speicher und wird im Hintergrund aufgefrischt.
// Alles andere: zuerst das Netz (Updates erscheinen wie bisher sofort), nur wenn kein Netz da ist, die zuletzt gespeicherte Kopie.
const NAME = 'womo-offline-1';
const NOTFALL = 'notfall.html';
const schluessel = (url) => { const u = new URL(url); return u.pathname.endsWith('/' + NOTFALL) ? u.origin + u.pathname : url; };

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(NAME).then((c) => c.add(new Request(NOTFALL, { cache: 'reload' }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;            // Firebase und Co. nie anfassen
  const k = schluessel(r.url);
  if (k !== r.url || u.pathname.endsWith('/' + NOTFALL)) {
    e.respondWith((async () => {
      const c = await caches.open(NAME);
      const alt = await c.match(k);
      const neu = fetch(r).then((a) => { if (a && a.ok) c.put(k, a.clone()); return a; }).catch(() => null);
      if (alt) { e.waitUntil(neu); return alt; }
      return (await neu) || new Response('Notfallkarte nicht gespeichert.', { status: 503 });
    })());
    return;
  }
  if (u.pathname.endsWith('/version.json')) { return; }  // immer frisch, nie aus dem Speicher: so bleibt das Update-Verfahren unveraendert
  e.respondWith((async () => {
    try {
      const a = await fetch(r);
      if (a && a.ok && a.type === 'basic') { const c = await caches.open(NAME); c.put(r.url, a.clone()); }
      return a;
    } catch (err) {
      const c = await caches.open(NAME);
      return (await c.match(r.url)) || (await c.match(r, { ignoreSearch: true })) || Response.error();
    }
  })());
});
