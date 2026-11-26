/* Оболочка для офлайна. Нужна ровно затем, чтобы приложение открывалось
   с домашнего экрана айфона без сети: без служебного работника iOS этого
   не умеет, сколько файл ни клади рядом.

   Чего этот файл НЕ делает и делать не должен:
   — не трогает IndexedDB. Записи владельца живут только там, и кэш о них
     ничего не знает. Снести кэш безопасно, снести базу — нет;
   — ничего не отправляет наружу;
   — не кэширует ничего, кроме трёх своих файлов и значков.

   Стратегия: отдаём из кэша сразу (приложение открывается мгновенно и в
   самолёте), а в фоне тихо тянем свежую копию. Правка, которую я выложу,
   встанет при следующем открытии. Это обычное поведение PWA, и оно же
   единственное, которое переживает отсутствие сети. */

const CACHE = 'mh-shell-3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  // Не ждём закрытия старых вкладок: приложение одно и оно одностраничное.
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {
      // Один недоступный файл не должен оставить приложение без оболочки:
      // кладём что положилось, остальное доберётся при первом запросе.
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // чужое не трогаем вовсе

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      const fresh = fetch(req).then(res => {
        // В кэш кладём только удачный ответ со своего адреса: страница
        // с ошибкой, попавшая в кэш, означает приложение, которое больше
        // не открывается.
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => null);

      if (hit) return hit;                    // есть копия — открываемся сразу
      return fresh.then(res => res || caches.match('./index.html'));
    })
  );
});
