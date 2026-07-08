const CACHE_NAME = 'anical-v2';

const APP_SHELL = [
    'index.html',
    'style.css',
    'script.js',
    'manifest.json'
];

self.addEventListener('install', (e) => {

    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );

    self.skipWaiting();
});

self.addEventListener('activate', (e) => {

    e.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener('fetch', (e) => {

    // let wallpaper/weather requests hit the network as normal, only
    // serve the app shell files from cache when offline
    if (!APP_SHELL.some((file) => e.request.url.endsWith(file))) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
});
