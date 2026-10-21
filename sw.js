// Service worker: guarda o app no aparelho para funcionar sem internet.
// Ao mudar a tabela de preços, aumente o número da versão abaixo (v3, v4...).
const CACHE = "passagem-efc-v2";
const PAGE = "index.html";
const FILES = [PAGE, "manifest.webmanifest", "favicon.ico",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png",
  "icons/apple-touch-icon.png", "icons/favicon-32.png"];

// Guarda uma cópia "limpa" da resposta. Servidores como o Netlify redirecionam
// /index.html para /, e uma resposta redirecionada no cache quebra o app offline.
async function store(cache, url) {
  const res = await fetch(url, { cache: "reload" });
  if (!res.ok) throw new Error(url + " " + res.status);
  const body = await res.blob();
  await cache.put(url, new Response(body, { status: 200, headers: res.headers }));
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(f => store(cache, f)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Abrir o app: usa a cópia guardada na hora (abre mesmo sem sinal) e,
  // se houver internet, atualiza a cópia em segundo plano para a próxima vez.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match(PAGE);
      const update = fetch(req).then(async res => {
        if (res.ok) {
          const c = await caches.open(CACHE);
          await c.put(PAGE, new Response(await res.clone().blob(), { status: 200, headers: res.headers }));
        }
        return res;
      });
      if (cached) { e.waitUntil(update.catch(() => {})); return cached; }
      try { return await update; } catch (_) { return Response.error(); }
    })());
    return;
  }

  // Ícones e manifesto: cópia guardada primeiro.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch (_) { return Response.error(); }
  })());
});
