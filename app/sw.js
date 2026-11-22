/* De Olho no Carrinho: cópia do app para abrir sem internet (gerado por build_pwa.py). */
var CACHE = "deolho-549e23269a", ARQ = ["./", "index.html", "manifest.webmanifest", "icone-180.png", "icone-192.png", "icone-512.png", "app-pre.js?v=e3ee4e0a", "app-post.js?v=70fef6a1", "fontes/inter-bold.woff", "fontes/inter-medium.woff", "fontes/inter-regular.woff", "fontes/inter-semibold.woff", "fontes/sora.woff", "lib/jsQR.js", "lib/pdf.min.js", "lib/pdf.worker.min.js", "lib/zxing.min.js"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQ); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE && k.indexOf("deolho-") === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function daRede(req) {
  return new Promise(function (ok, falha) {
    var t = setTimeout(function () { falha(new Error("demorou")); }, 4000);
    fetch(req).then(function (r) { clearTimeout(t); if (r && r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); } ok(r); }, function (e) { clearTimeout(t); falha(e); });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request, u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== self.location.origin) return;
  var fixo = /\/(fontes|lib)\/|icone-/.test(u.pathname);
  if (fixo) {
    e.respondWith(caches.match(req).then(function (r) { return r || fetch(req); }));
    return;
  }
  e.respondWith(daRede(req).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: true }); });
  }));
});
