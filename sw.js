'use strict';
// Keep the number in step with BUILD in app.js
const CACHE_NAME = 'tracker-v55';
const APP_FILES = [
  './',
  './index.html',
  './app.css',
  './plan.js',
  './app.js',
  './screens/today.js',
  './screens/workouts.js',
  './screens/meals.js',
  './screens/history.js',
  './screens/bodyweight.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
// How long to wait for the network before using the offline copy (weak gym signal)
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never stores old files
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.all(APP_FILES.map(f =>
        fetch(new Request(f, { cache: 'reload' })).then(r => { if (r.ok) return c.put(f, r); }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network first (so updates show on the next open), falling back to the offline copy
// when there's no signal or it takes longer than NETWORK_TIMEOUT_MS. Only app files on
// this site are handled; data lives in localStorage and is never touched here.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const fromCache = () => cache.match(e.request, { ignoreSearch: true })
      .then(r => r || (e.request.mode === 'navigate' ? cache.match('./index.html') : undefined));
    const network = fetch(e.request, { cache: 'no-cache' }).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') cache.put(e.request, resp.clone());
      return resp;
    });
    const timeout = new Promise(res => setTimeout(res, NETWORK_TIMEOUT_MS, null));
    try {
      const winner = await Promise.race([network, timeout]);
      if (winner) return winner;
      return (await fromCache()) || await network;   // slow network: use offline copy if we have it
    } catch (err) {
      return (await fromCache()) || Response.error(); // offline
    }
  })());
});
