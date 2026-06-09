const CACHE_NAME = 'espetos-v3.2';
const assets = [
    './index.html',
    './dashboard.html',
    './dashBoardFunc.html',
    './server/dashBoard.js',
    './server/bipar.js',
    './server/login.js',
    './server/navigation.js',
    './css/style.css',
    './css/dashBoard.css',
    './css/dashBoardFunc.css'
];

// Instala o Service Worker
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Executa as requisições
self.addEventListener('fetch', fetchEvent => {
  fetchEvent.respondWith(
    caches.match(fetchEvent.request).then(res => {
      return res || fetch(fetchEvent.request);
    })
  );
});